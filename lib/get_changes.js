var checkFilter = require('json-filter')
var isMeta = require('./is_meta')

module.exports = function(changeInfo){
  if (changeInfo.action === 'append' && changeInfo.matcher){
    var ignoreKeys = Object.keys(changeInfo.matcher.match)
    return Object.keys(changeInfo.object).reduce(function(changes, key){
      if (!isMeta(key)  && !~ignoreKeys.indexOf(key)){
        changes[key] = changeInfo.object[key]
      }
      return changes
    }, {})
  } else {
    var changedKeys = getChangedKeys(changeInfo.original, changeInfo.object)
    return changedKeys.reduce(function(result, key){
      if (!isMeta(key) && key !== '_deleted'){
        result[key] = (changeInfo.object[key] != null) ? changeInfo.object[key] : null
      }
      return result
    }, {})
  }
}

function getChangedKeys(original, changed){
  if (!original){
    return Object.keys(changed)
  }
  
  var allKeys = union(Object.keys(original), Object.keys(changed))
  var keys = []
  
  allKeys.forEach(function(key){
    if (!checkFilter(original[key], changed[key], {match: 'all'})){
      keys.push(key)
    }
  })
  
  return keys
}

function union(original, other){
  var newArray = original.concat()
  other.forEach(function(item){
    if (!~newArray.indexOf(item)){
      newArray.push(item)
    }
  })
  return newArray
}