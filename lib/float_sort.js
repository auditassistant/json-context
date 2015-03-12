module.exports = function(object, collection, options){
  var key = options.key
  var index = collection.indexOf(object)
  var result = null

  if (object[key] != null){
    var correctIndex = getCorrectIndex(object, collection, {
      key: options.key,
      after: options.after,
      index: index
    })

    if (correctIndex != index && correctIndex != -1){

      if (correctIndex === collection.length){
        collection.splice(index, 1)
        collection.push(object)
        
      // or insert
      } else { 
        collection.splice(index, 1)
        if (correctIndex > index){
          correctIndex -= 1 // shift up if needed
        }
        collection.splice(correctIndex, 0, object)
      }

      if (index === 0){
        return {key: index, after: 'start'}
      } else {
        return {key: index, after: collection[index-1]}
      }

    }
  }
}

function getCorrectIndex(object, collection, options){
  var key = options.key
  var objectKey = parseFloat(object[key]) || 0

  if (options.reverse){

    for (var i=0;i<collection.length;i++){
      if (collection[i] && (parseFloat(collection[i][key])||0) < objectKey){
        return i
      }
    }

    return 0
  } else {
    for (var i=0;i<collection.length;i++){
      if (collection[i] && (parseFloat(collection[i][key])||0) > objectKey){
        return i
      }
    }

    return collection.length
  }


}