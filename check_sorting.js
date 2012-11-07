module.exports = function(object, changeInfo){
  var collection = changeInfo.collection
  var matcher = changeInfo.matcher

  var shouldAvoidDuplicates = changeInfo.source === 'user'

  if (matcher.sort && Array.isArray(collection)){
    var sortingChange = sort(object, changeInfo.collection, mergeClone(matcher.sort, {
      shouldAvoidDuplicates: shouldAvoidDuplicates, 
      index: changeInfo.key
    }))
    return mergeClone(changeInfo, sortingChange)
  }
    
  return changeInfo
}

function sort(object, collection, options){
  options = options || {}
  
  options.type = options.type || 'after'
  options.key = options.key || options.type
  options.compareKey = options.compareKey || 'id'
  if (options.index == null){
    options.index = collection.indexOf(object)
  }  
  
  if (object[options.key] && !inCorrectLocation(object, collection, options)){
    
    var correctIndex = getCorrectIndex(object, collection, options)
    if (correctIndex != options.index && correctIndex != -1){
      if (!options.shouldAvoidDuplicates || !isConflict(object, collection[correctIndex], options.key)){
        // append ...
        if (correctIndex === collection.length){
          collection.splice(options.index, 1)
          collection.push(object)
          
        // or insert
        } else { 
          collection.splice(options.index, 1)
          if (correctIndex > options.index){
            correctIndex -= 1 // shift up if needed
          }
          collection.splice(correctIndex, 0, object)
        }
        
        return getChange(collection, correctIndex, options)
        
      }
    }
    
  }

}

function getChange(collection, index, options){
  if (options.type === 'before'){
    if (index === collection.length - 1){
      return {key: index, before: 'end'}
    } else {
      return {key: index, before: collection[index+1]}
    }
  } else if (options.type === 'after'){
    if (index === 0){
      return {key: index, after: 'start'}
    } else {
      return {key: index, after: collection[index-1]}
    }
  }
}

function isConflict(object, destination, key){
  return destination && destination[key] != null && destination[key] == object[key]
}

function getCorrectIndex(object, collection, options){
  var value = object[options.key]
  if (options.type === 'before'){
    if (value === -1){
      return collection.length
    } else {
      return getMatchingIndex(collection, options.compareKey, value)
    }
    
  } else if (options.type === 'after'){
    if (value === -1){
      return 0
    } else {
      var index = getMatchingIndex(collection, options.compareKey, value)
      if (index === -1){
        return -1
      } else {
        return index + 1
      }
    }
  }
}

function getMatchingIndex(collection, key, value){
  for (var i=0;i<collection.length;i++){
    var compareItem = collection[i]
    if (compareItem[key] === value){
      return i
    }
  }
  return -1
}

function inCorrectLocation(object, collection, options){
  
  var value = object[options.key]
  var index = options.index != null ? options.index : collection.indexOf(object)
  
  if (options.type === 'after'){
    if (value === -1){
      return index === 0
    } else {
      if (index > 0){
        var compareItem = collection[index-1]
        return compareItem[options.compareKey] == value
      }
    }
    
  } else if (options.type === 'before'){
    if (value === -1){
      return index+1 === collection.length
    } else {
      if (index < collection.length-1){
        var compareItem = collection[index+1]
        return compareItem[options.compareKey] == value
      }
    }
  } else {
    // no search match so let's just let this through
    return true
  }

  return false
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