var jsonQuery = require('json-query')
var EventEmitter = require('events').EventEmitter
var ContextStream = require('./lib/context_stream')

var mergeClone = require('./lib/merge_clone')
var mergeInto = require('./lib/merge_into')
var obtain = require('./lib/obtain')
var getChanges = require('./lib/get_changes')
var checkAllowedChange = require('./lib/check_allowed_change')
var checkCollectionPosition = require('beforesort')

var checkFilter = require('json-filter')

//  TODO: include (another datasource has all its changes piped in and any relevant changes piped back to it)
//        good for multiserver contexts - e.g. account is stored in one db, projects in another.

module.exports = function(options){
  var self = new EventEmitter()
  self.matchers = options.matchers || []
  self.data = options.data || {}
  self.dataFilters = options.dataFilters || options.filters || {}
  

  self.pushChange = function(object, changeInfo){
    var matchers = null
    if (changeInfo && changeInfo.matcher){
      matchers = [changeInfo.matcher]
    } else {
      matchers = findMatchers(self.matchers, object, self.get)
    }


    var result = {accepted: false}

    result.changes = matchers.map(function(matcher){   


      var originalQuery = self.query(matcher.item, object)
      var original = originalQuery.value
      
      changeInfo = mergeClone(changeInfo, {
        action: getAction(object, original), 
        original: obtain(original), 
        matcher: matcher, 
        object: object
      })

      if (original){
        changeInfo.collection = jsonQuery.lastParent(originalQuery)
      }

      function push(info){
        if (info){
          Object.keys(info).forEach(function(key){
            changeInfo[key] = info[key]
          })
        }
      }

      changeInfo.changes = getChanges(changeInfo)
      changeInfo.verifiedChange = checkAllowedChange(self, changeInfo)

      if (changeInfo.verifiedChange){
        if (changeInfo.action === 'append'){
          push(append(self, matcher, object))
          push(ensureCorrectPosition(object, changeInfo))
          self.emit('change', object, changeInfo)
        } else if (changeInfo.action === 'update'){
          push(mergeInto(original, object, {preserveKeys: matcher.preserveKeys}))
          push(ensureCorrectCollection(self, matcher, object))
          push(ensureCorrectPosition(original, changeInfo))
          self.emit('change', original, changeInfo)
        } else if (changeInfo.action === 'remove' && original){
          removeAt(changeInfo.collection, originalQuery.key)
          original._deleted = true
          self.emit('change', original, changeInfo)
        }
        result.accepted = true
      } else if (changeInfo.errors) {
        result.errors = result.errors || []
        changeInfo.errors.forEach(function(error){
          result.errors.push(error)
        })
      }

      return changeInfo
    })

    return result
  }

  self.query = function(query, context, options){
    options = mergeClone({
      rootContext: self.data, 
      context: context, 
      filters: self.dataFilters
    }, options)
    return jsonQuery(query, options)
  }

  self.get = function(query, context, options){
    return self.query(query, context, options).value
  }

  self.obtain = function(query, context, options){
    if (query instanceof Object && !Array.isArray(query)){
      return obtain(query) // we already have the result, so clone and return it
    } else { 
      return obtain(self.get(query, context, options))
    }
  }

  self.changeStream = function(options){
    return ContextStream(self, options)
  }

  self.matchersFor = function(object){
    return findMatchers(self.matchers, object, self.get)
  }

  // shortcut for obtain/merge/push combo
  self.update = function(query, changes, changeInfo){
    var result = self.obtain(query, changes, options)
    if (changes){
      Object.keys(changes).forEach(function(key){
        result[key] = changes[key]
      })
    }
    return self.pushChange(result, changeInfo)
  }

  // find items in collection on either side of object - good for sorting, etc
  self.siblings = function(object){
    var matcher = self.matchersFor(object)[0]
    if (matcher){
      var queryResult = self.query(matcher.item, object)
      var collection = jsonQuery.lastParent(queryResult)
      return {previous: collection[queryResult.key - 1], next: collection[queryResult.key + 1]}
    } else {
      return {}
    }
  }

  self.toJSON = function(){
    // TODO: should strip $meta from context.data
    return JSON.stringify({data: self.data, matchers: self.matchers})
  }

  return self
}

module.exports.obtain = obtain
function append(context, matcher, object){
  if (matcher.collection){
    var collection = getCollection(context, matcher, object)
    if (Array.isArray(collection)){
      collection.push(object)
      return {key: collection.length-1, collection: collection}
    } else if (collection instanceof Object && matcher.collectionKey) {
      var key = context.get(matcher.collectionKey, object)
      collection[key] = object
      return {key: key, collection: collection}
    }
  } else if (matcher.item){
    // force the object into position
    var queryResult = context.query(matcher.item, object, {force: object})
    return {key: queryResult.key, collection: jsonQuery.lastParent(queryResult)}
  }
}

function ensureCorrectCollection(context, matcher, object){
  if (matcher.collection){
    var originalQuery = context.query(matcher.item, object)
    var originalCollection = jsonQuery.lastParent(originalQuery)
    var targetCollection = getCollection(context, matcher, object)
    if (originalCollection !== targetCollection){
      removeAt(originalCollection, originalQuery.key)
      append(context, matcher, originalQuery.value)
      return {
        originalCollection: originalCollection, 
        originalKey: originalQuery.key, 
        collection: targetCollection
      }
    } else {
      return {
        collection: targetCollection
      }
    }
  } 
}

function ensureCorrectPosition(object, changeInfo){
  var object = object
  var collection = changeInfo.collection
  var matcher = changeInfo.matcher

  var shouldAvoidDuplicates = !changeInfo.external

  if (changeInfo.after){
    var previous = changeInfo.key-1
    var startMatch = changeInfo.after === 'start' && previous == null

    if (!startMatch && previous !== changeInfo.after){
      var index = collection.indexOf(object)
      collection.splice(index, 1)

      var newIndex = changeInfo.after === 'start' ? 
        0 : (collection.indexOf(changeInfo.after) + 1)

      collection.splice(newIndex, 0, object)
      changeInfo.key = newIndex
    }

  } else if (matcher.sort && Array.isArray(collection)){

    var sortingChange = checkCollectionPosition(object, changeInfo.collection, mergeClone(matcher.sort, {
      shouldAvoidDuplicates: shouldAvoidDuplicates, 
      index: changeInfo.key
    }))

    return sortingChange
  }
}

function getCollection(context, matcher, object){
  if (matcher.collectionKey){
    return context.get(matcher.collection, object, {force: {}})
  } else {
    return context.get(matcher.collection, object, {force: []})
  }
}

function findMatchers(matchers, object, queryHandler){
  return matchers.filter(function(matcher){
    return matcher.match && checkFilter(object, matcher.match, {queryHandler: queryHandler})
  })
}

function getAction(object, original){
  if (object._deleted){
    return 'remove'
  } else if (original){
    return 'update'
  } else {
    return 'append'
  }
}

function removeAt(collection, key){
  if (Array.isArray(collection)){
    collection.splice(key, 1)
  } else {
    delete collection[key]
  }
}