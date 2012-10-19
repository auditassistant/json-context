var jsonChangeStream = require('json-change-stream')
  , jsonQuery = require('json-query')
  , jsonChangeFilter = require('json-change-filter')
  
  
module.exports = function(data, options){
  // options: dataFilters
  
  var options = options || {}
  
  // main pipe/router
  var context = jsonChangeStream.connect(
    jsonChangeFilter({
      originalHandler: function(object, changeInfo){
        var matcher = changeInfo.matchers[0]
        return matcher && context.get(matcher.item, object)
      },
      matchers: function(object, changeInfo, iterate){
        context.matchers.forEach(iterate)
      }
    }), function(object, changeInfo){
      if (changeInfo.action == 'remove' || changeInfo.action == 'moved'){
        remove(object, changeInfo)
      } else if(changeInfo.action == 'append'){
        append(object, changeInfo)
      } else if (changeInfo.action == 'update'){
        if (inCorrectCollection(object, changeInfo)){
          update(object, changeInfo)
        } else {
          remove(changeInfo.original, changeInfo)
          append(object, changeInfo)
        }
      }
    }
  )
  
  context.data = data
  context.dataFilters = options.dataFilters || {}
  context.matchers = options.matchers || context.data.$matchers || []
  context._isContext = true
  
  context.get = function(path, object, options){
    return context.query(path, object, options).value
  }
  context.obtain = function(path, object, options){
    return deepClone(context.query(path, object, options).value)
  }
  context.query = function(path, object, options){
    // set up options
    var defaultOptions = {rootContext: context.data, context: object, filters: context.dataFilters}
    if (options){
      Object.keys(options).forEach(function(key){
        defaultOptions[key] = options[key]
      })
    }
    return jsonQuery(path, defaultOptions)
  }
  
  
  
  
  function update(newObject, changeInfo){
    var query = context.query(changeInfo.matcher.item, newObject)
    if (query.value){
            
      var object = query.value
        , collection = jsonQuery.lastParent(query)
      
      var original = deepClone(object)
      changeInfo = mergeClone(changeInfo, {action: 'update', collection: collection, original: original})
      
      mergeInto(object, newObject)

      // notify changes
      context.emit('change', object, changeInfo)
    }
  }
  
  function remove(object, changeInfo){
    // remove item from context
    var query = context.query(changeInfo.matcher.item, object)
    var collection = jsonQuery.lastParent(query)
    
    if (collection && query.key != null){
      
      var deletedObject = mergeClone(query.value, {_deleted: true})
      changeInfo = mergeClone(changeInfo, {action: 'remove', collection: collection, original: query.value, key: query.key, filter: changeInfo.matcher.filter})
      
      
      if (Array.isArray(collection)){
        collection.splice(query.key, 1)
      } else {
        delete collection[query.key]
      }
      
      context.emit('change', deletedObject, changeInfo)
        
    }
  }
  
  function append(newObject, changeInfo){
    if (changeInfo.matcher.collectionKey){
      
      // collection is not an array so we need to set the key manually
      var collection = context.get(changeInfo.matcher.collection, newObject, {force: {}})
      var key = context.get(changeInfo.matcher.collectionKey, newObject)
      
      if (key != null){
        
        changeInfo = mergeClone(changeInfo, {action: 'append', collection: collection, key: key, filter: changeInfo.matcher.filter})
        
        if (query.value[key]){
          // this key is being overwritten so emit object removal
          context.emit('change', 
            mergeClone(query.value[key], {_deleted: true}), 
            mergeClone(changeInfo, {action: 'remove', collection: collection, original: query.value[key]})
          )
        }
        
        query.value[key] = newObject
        context.emit('change', newObject, changeInfo)        
      }
    } else {
      
      var collection = context.get(changeInfo.matcher.collection, newObject, {force: []})
      changeInfo = mergeClone(changeInfo, {action: 'append', collection: collection, key: collection.length-1, filter: changeInfo.matcher.filter})
      
      collection.push(newObject)
      context.emit('change', newObject, changeInfo)
    }
  }
  
  function inCorrectCollection(object, changeInfo){
    if (changeInfo.matcher.collection){
      var itemMatch = context.query(changeInfo.matcher.item, object)
        , collectionMatch = context.get(changeInfo.matcher.collection, object, {force: []})
        , currentCollection = jsonQuery.lastParent(itemMatch)
      
      if (itemMatch.value){
        return collectionMatch === currentCollection
      }
    }
    return true
  }
 
  return context
}

function mergeInto(original, changed){

  var newKeys = Object.keys(changed)

  newKeys.forEach(function(key){
  
    // only update actual attributes - ignore meta attributes
    if (!isMeta(key)){
      if (original[key] !== changed[key]){
        if ((original[key] instanceof Object) && (changed[key] instanceof Object)){
          // recursive update
          update(original[key], changed[key])
        } else {
          original[key] = changed[key]
        }
      }
    }
  
  })
  
  // remove unused keys
  if (Array.isArray(original)){
    // truncate to length of new array
    original.length = changed.length
  } else {
    Object.keys(original).filter(function(key){
      return !isMeta(key) && (!~newKeys.indexOf(key))
    }).forEach(function(key){
      delete original[key]
    })
  }
  
}

function deepClone(object){
  return JSON.parse(JSON.stringify(object, function(k,v){
    // strip meta data from cloned
    if (!isMeta(k)){
      return v
    }
  }))
}

function mergeClone(){
  var result = {}
  for (var i=0;i<arguments.length;i++){
    var obj = arguments[i]
    if (obj){
      Object.keys(obj).forEach(function(key){
        result[key] = obj[key]
      })
    }
  }
  return result
}

function isMeta(key){
  return (typeof key === 'string' && key.charAt(0) === '$')
}
