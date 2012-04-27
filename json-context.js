var jsonChangeStream = require('json-change-stream')
  , jsonQuery = require('json-query')
  , jsonChangeFilter = require('json-change-filter')
  
  
module.exports = function(data, options){
  // options: dataFilters
  
  var options = options || {}
  
  var context = jsonChangeStream(function(object, changeInfo){
    
    var matchers = getMatchers(object, changeInfo)
    
    matchers.forEach(function(matcher){
      handleChange(object, mergeClone(changeInfo, {matcher: matcher}))
    })
    
  })
  
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
      
      if (checkChangeFilter(object, changeInfo)){
        // merge new object into old object preserving references when it can
        mergeInto(object, newObject)

        // notify changes
        context.emit('change', object, changeInfo)
      }
      
    }
    

  }
  
  function remove(object, changeInfo){
    // remove item from context
    
    
    var query = context.query(changeInfo.matcher.item, object)
    var collection = jsonQuery.lastParent(query)
    
    if (collection && query.key != null){
      
      var deletedObject = mergeClone(query.value, {_deleted: true})
      changeInfo = mergeClone(changeInfo, {action: 'remove', collection: collection, original: query.value, key: query.key, filter: changeInfo.matcher.filter})
      
      if (checkChangeFilter(deletedObject, changeInfo)){
      
        if (Array.isArray(collection)){
          collection.splice(query.key, 1)
        } else {
          delete collection[query.key]
        }
        
        context.emit('change', deletedObject, changeInfo)
        
      }
      
    }

  }
  
  function append(newObject, changeInfo){
    
    if (changeInfo.matcher.collectionKey){
      
      // collection is not an array so we need to set the key manually
      var collection = context.get(changeInfo.matcher.collection, newObject, {force: {}})
      var key = context.get(changeInfo.matcher.collectionKey, newObject)
      
      if (key != null){
        
        changeInfo = mergeClone(changeInfo, {action: 'append', collection: collection, key: key, filter: changeInfo.matcher.filter})
        
        if (checkChangeFilter(newObject, changeInfo)){
        
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
        
      }
    } else {
      
      var collection = context.get(changeInfo.matcher.collection, newObject, {force: []})
      changeInfo = mergeClone(changeInfo, {action: 'append', collection: collection, key: collection.length-1, filter: changeInfo.matcher.filter})
      
      if (checkChangeFilter(newObject, changeInfo)){
        collection.push(newObject)
        context.emit('change', newObject, changeInfo)
      }
      
    }
  }
  
  function handleChange(object, changeInfo){
    
    var matcher = changeInfo.matcher
    
    if (object._deleted){
      
      // item has been deleted, get rid of it locally
      remove(object, changeInfo)
      
    } else {
      
      var itemMatch = context.query(matcher.item, object)
      
      if (matcher.collection){
        var collectionMatch = context.query(matcher.collection, object, {force: []})
          , currentCollection = jsonQuery.lastParent(itemMatch)
        
        if (itemMatch.value){
          if (collectionMatch.value === currentCollection){
            // item is in the right collection, just update the params
            update(object, changeInfo)
          } else {
            // item is not in the right collection. Remove the old one and add the new one in the correct place
            remove(object, changeInfo)
            append(object, changeInfo)
          }
        } else {
          // this is a new item, go ahead and append it
          append(object, changeInfo)
        }
      } else {
        // if there is no collection, just update the item
        update(object, changeInfo)
      }
      
    }
  }
  
  function getMatchers(object, changeInfo){
    var matchers = context.matchers || []
    changeInfo = changeInfo || {}
    if (!changeInfo.matcher){
      return matchers.filter(function(matcher){
        return !!jsonChangeFilter(matcher.filter.match, object, {original: changeInfo.original})
      })
    } else {
      return [changeInfo.matcher]
    }
  }
  
  return context
}


function checkChangeFilter(object, changeInfo){
  if (changeInfo.matcher && changeInfo.matcher.filter.change && isLocal(changeInfo.source)){
    jsonChangeFilter(changeInfo.matcher.filter.change, object, {original: changeInfo.original})
  } else {
    return true
  }
}

function isLocal(source){
  return (!source || source === 'local' || source._isLocal)
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
  return (key.charAt(0) === '$')
}
