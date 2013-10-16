var Split = require('split')
var Through = require('through')

var isMeta = require('./is_meta')
var mergeClone = require('./merge_clone')

module.exports = function(datasource, options){

  options = options || {}

  options.external = true

  var incomingStream = Split()

  var contextStream = options.source = Through(function(data){
    incomingStream.write(data)
  }, function(){
    datasource.removeListener('change', changeListener)
    incomingStream.destroy()
    contextStream.queue(null)
  })

  contextStream.datasource = datasource

  function changeListener(object, changeInfo){
    if (changeInfo.source !== contextStream){
      var data = {object: object, time: changeInfo.time}
      contextStream.queue(safeStringify(data) + '\n')
    }
  }

  datasource.on('change', changeListener)

  contextStream.requestChangesSince = function(timestamp){
    contextStream.queue(JSON.stringify({since: timestamp}) + '\n')
  }

  contextStream.requestAll = function(){
    contextStream.queue(JSON.stringify({ get: 'all' }) + '\n')
  }

  contextStream.emitAll = function(){
    contextStream.queue(JSON.stringify({
      context: { data: datasource.data, matchers: datasource.matchers }
    }) + '\n')
  }

  incomingStream.pipe(ParseJson()).on('data', function(data){

    if (data.get == 'all'){
      contextStream.emitAll()
    } else if (data.context && options.verifiedChange){
      datasource.matchers = data.context.matchers || []
      datasource.data = data.context.data || {}
      datasource.emit('sync')
    } else if (data.since && datasource.emitChangesSince){
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