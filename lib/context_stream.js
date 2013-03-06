var Split = require('split')
var Duplex = require('duplex')
var Through = require('through')

var isMeta = require('./is_meta')
var mergeClone = require('./merge_clone')

module.exports = function(datasource, options){

  options = options || {}

  options.external = true

  var incomingStream = Split()
  var contextStream = options.source = Duplex().on('_data', function(data){
    incomingStream.write(data)
  })

  datasource.on('change', function(object, changeInfo){
    if (changeInfo.source !== contextStream){
      var data = {object: object, seq: changeInfo.seq}
      contextStream._data(safeStringify(data) + '\n')
    }
  })

  contextStream.requestChangesSince = function(timestamp){
    contextStream._data({since: timestamp} + '\n')
  }

  incomingStream.pipe(ParseJson()).on('data', function(data){
    if (data.since && datasource.emitChangesSince){
      datasource.emitChangesSince(data.since)
    } else if (data.object){
      datasource.pushChange(data.object, options)
      if (data.seq && (!contextStream.seq || contextStream.seq < data.seq)){
        contextStream.seq = data.seq
      }
    }
  })

  return contextStream
}

function safeStringify(object){
  return JSON.stringify(object, function(k,v){
    if (!isMeta(k)){
      return v
    }
  })
}

function ParseJson(){
  return Through(function write(data) {
    this.emit('data', JSON.parse(data))
  })
}