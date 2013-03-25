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
  }).on('_end', function(){
    datasource.removeListener('change', changeListener)
    incomingStream.destroy()
  })

  contextStream.datasource = datasource

  function changeListener(object, changeInfo){
    if (changeInfo.source !== contextStream){
      var data = {object: object, time: changeInfo.time}
      contextStream._data(safeStringify(data) + '\n')
    }
  }

  datasource.on('change', changeListener)

  contextStream.requestChangesSince = function(timestamp){
    contextStream._data(JSON.stringify({since: timestamp}) + '\n')
  }

  incomingStream.pipe(ParseJson()).on('data', function(data){
    if (data.since && datasource.emitChangesSince){
      datasource.emitChangesSince(data.since)
    } else if (data.object){
      datasource.pushChange(data.object, options)
      if (data.time && (!contextStream.time || contextStream.time < data.time)){
        contextStream.time = data.time
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