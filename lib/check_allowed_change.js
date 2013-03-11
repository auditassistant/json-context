module.exports = function(context, changeInfo){  
  if (!changeInfo.verifiedChange){
    if (changeInfo.matcher.allow){

      var allowQueries = changeInfo.matcher.allow

      var result = null

      if (allowQueries.hasOwnProperty('change')){
        var changePerm = allowQueries.change
        if (typeof changePerm == 'boolean'){
          result = changePerm
        } else {
          result = checkQueries(context, changePerm, changeInfo)
        }
      }

      if (result !== false && allowQueries.hasOwnProperty(changeInfo.action)){
        var actionPerm = allowQueries[changeInfo.action]
        if (typeof actionPerm == 'boolean'){
          result = actionPerm
        } else {
          result = checkQueries(context, actionPerm, changeInfo)
        }
      }

      if (result === changeInfo){
        return false
      }

      return result || false
    }
  }
  return changeInfo.verifiedChange || false
}

function checkQueries(context, queries, changeInfo){
  if (!queries || !queries.length){
    return false
  } else {
    if (typeof queries == 'string'){
      var result = context.get(queries, changeInfo)
      return result !== changeInfo && !!result
    } else {
      return queries.every(function(query){
        var result = context.get(query, changeInfo)
        return result !== changeInfo && !!result
      })
    }
  }
}