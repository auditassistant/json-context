module.exports = function(key){
  return (typeof key === 'string' && key.charAt(0) === '$')
}