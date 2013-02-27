var jsonChangeStream = require('json-change-stream')
  , jsonQuery = require('json-query')
  , jsonChangeFilter = require('json-change-filter')
  , checkSorting = require('./check_sorting')
  
  
module.exports = function(data, options){
  // options: dataFilters, matchers
  
  var options = options || {}
  
  // main pipe/router
  var context = jsonChangeStream.connect(
    jsonChangeFilter({
      originalHandler: function(object, changeInfo){
        var original = null
        changeInfo.matchers.some(function(matcher){
          original = context.get(matcher.item, object) || null
          return !!original
        })

        return original
      },
      queryHandler: function(query, changeInfo){
        return context.get(query, changeInfo)
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
        update(object, changeInfo)
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
  
  context.queryFor = function(object){
    var matchers = context.matchersFor(object)
    if (matchers.length > 0){
      return context.query(matchers[0].item, object)
    }
  }
  
  context.matchersFor = function(object){
    return jsonChangeFilter.findMatchers(object, context.matchers)
  }
  
  context.siblings = function(object){
    var matcher = context.matchersFor(object)[0]
    if (matcher){
      var queryResult = context.query(matcher.item, object)
      var collection = jsonQuery.lastParent(queryResult)
      return {previous: collection[queryResult.key - 1], next: collection[queryResult.key + 1]}
    } else {
      return {}
    }
  }

  
  function update(newObject, changeInfo){
    
    var removedItems = []
    var addedItems = []
    
    function mergeInto(original, changed, preserveKeys){
      preserveKeys = preserveKeys || []
      var newKeys = Object.keys(changed)
      var originalLength = Array.isArray(original) && original.length

      newKeys.forEach(function(key){
        // only update actual attributes - ignore meta attributes
        if (!isMeta(key)){
          if (original[key] !== changed[key]){
            if ((original[key] instanceof Object) && (changed[key] instanceof Object)){
              // recursive update
              mergeInto(original[key], changed[key])
            } else {
              original[key] = changed[key]
              
              // for handling element sources that are strings/numbers rather than objects
              if (original.$proxy && original.$proxy[key]){
                original.$proxy[key].value = changed[key]
              }
              
            }
          }
        }

      })

      if (Array.isArray(original)){
        for (var i=changed.length;i<original.length;i++){
          if (original.$proxy && original.$proxy[i]){
            removedItems.push({collection: original, item: original.$proxy[i], index: i})
          } else {
            removedItems.push({collection: original, item: original[i], index: i})
          }
        }
        for (var i=originalLength;i<changed.length;i++){
          addedItems.push({collection: original, item: original[i], index: i})
        }
        
        // remove unused keys
        // truncate to length of new array
        original.length = changed.length
        if (original.$proxy){
          original.$proxy.length = changed.length
        }
      } else {
        Object.keys(original).filter(function(key){
          return !isMeta(key) && (!~newKeys.indexOf(key)) && (!~preserveKeys.indexOf(key))
        }).forEach(function(key){
          delete original[key]
        })
      }
    }
    
    var query = context.query(changeInfo.matcher.item, newObject)
    
    var object = query.value
      , collection = jsonQuery.lastParent(query)
    
    if (object){

      // sort item
      
      var original = deepClone(object)
      changeInfo = mergeClone(changeInfo, {
        action: 'update', 
        collection: collection, 
        original: original, 
        removedItems: removedItems, 
        addedItems: addedItems, 
        key: query.key
      })
      
      mergeInto(object, newObject, changeInfo.matcher.preserveKeys)
      
      changeInfo = checkCorrectCollection(object, changeInfo)      
      changeInfo = checkSorting(object, changeInfo)

      // notify changes
      context.emit('change', object, changeInfo)
    } else {
      append(newObject, changeInfo)
    }
  }
  
  function remove(object, changeInfo){
    // remove item from context
    var query = context.query(changeInfo.matcher.item, object)
    var collection = jsonQuery.lastParent(query)
    
    if (collection && query.key != null){
            
      var deletedObject = query.value
      query.value._deleted = true
      
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
      
      if (changeInfo.matcher.collection){
        var collection = context.get(changeInfo.matcher.collection, newObject, {force: []})
        changeInfo = mergeClone(changeInfo, {action: 'append', collection: collection, key: collection.length-1, filter: changeInfo.matcher.filter})

        collection.push(newObject)
      } else if (changeInfo.matcher.item){
        
        var query = context.query(changeInfo.matcher.item, newObject, {force: newObject})
        var object = query.value
          , collection = jsonQuery.lastParent(query)

        changeInfo = mergeClone(changeInfo, {action: 'append', collection: collection, key: query.key, filter: changeInfo.matcher.filter})
      }      
      
      changeInfo = checkSorting(newObject, changeInfo)

      context.emit('change', newObject, changeInfo)
    }
  }
  
  function checkCorrectCollection(object, changeInfo){
    //TODO: handle matcher.collectionKey
    if (changeInfo.matcher.collection){
    
      var collectionMatch = context.get(changeInfo.matcher.collection, object, {force: []})      
      if (Array.isArray(collectionMatch) && collectionMatch !== changeInfo.collection){
        
        // move to correct collection
        changeInfo.collection.splice(changeInfo.key, 1)
        collectionMatch.push(object)
        
        return mergeClone(changeInfo, {key: collectionMatch.length-1, collection: collectionMatch, originalCollection: changeInfo.collection})
      }
    }
    return changeInfo
  }
 
  return context
}
module.exports.lastParent = jsonQuery.lastParent
module.exports.obtain = function(object){
  return deepClone(object)
}

module.exports.obtainMerge = function(object, changes){
  var result = deepClone(object)
  if (changes){
    Object.keys(changes).forEach(function(key){
      result[key] = changes[key]
    })
  }
  return result
}

module.exports.safeStringify = safeStringify

function deepClone(object){
  return JSON.parse(safeStringify(object))
}
function safeStringify(object){
  return JSON.stringify(object, function(k,v){
    if (!isMeta(k)){
      return v
    }
  })
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
