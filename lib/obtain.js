var isMeta = require('./is_meta')

module.exports = function(object){
  if (object){
    return JSON.parse(safeStringify(object))
  } else {
    return null
  }
}

function safeStringify(object){
  return JSON.stringify(object, function(k,v){
    if (!isMeta(k)){
      return v
    }
  })
}

