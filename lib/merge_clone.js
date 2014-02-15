module.exports = function mergeClone(a, b){
  var result = {}

  if (a){
    for (var key in a){
      if (key in a){
        result[key] = a[key]
      }
    }
  }

  if (b){
    for (var key in b){
      if (key in b){
        result[key] = b[key]
      }
    }
  }

  return result
}