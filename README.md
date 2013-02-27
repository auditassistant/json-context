# JSON Context

This module allows a server to create a JSON Context - single object that supports querying and contains all data required to render a view/page. When sent to the client it also provides an event stream for syncing with server and data-binding.

The idea is it works in a similar way to your database (well depends on the database), using a update whole object at once (i.e. row/document based) aproach. Any changes that come off our database can be streamed straight in and it will figure out what local objects and fields to update, and notify that the object has been changed.

It is intended to be used in conjunction with [Realtime Templates](https://github.com/mmckegg/realtime-templates) however can be used standalone if that's what you're into.

It's mostly a wrapper around [JSON Query](https://github.com/mmckegg/json-query) and [JSON Change Filter](https://github.com/mmckegg/json-change-filter) making it easy to get up and running with object change streams and hook up to data on both the server and client.

## Installation

```shell
$ npm install json-context
```

## Example

See [Realtime Templates](https://github.com/mmckegg/realtime-templates) for example usage.

## API

### require('json-context')(data, options)

Pass in starting data. Returns event emitting **datasource**.

Options:

- dataFilters: passed to the inner instance of [JSON Query](https://github.com/mmckegg/json-query)
- matchers: passed to the inner instance of [JSON Change Filter](https://github.com/mmckegg/json-change-filter) - basically a routing system - where to put incoming objects, and who is allowed to change what. 

### datasource.pushChange(object, changeInfo)

Pushes an object into the datasource using the specified matchers to decide where it should go. If the object already existed in the datasource (as decided by the matcher), it will be updated to match the attributes of the object being pushed in. 

Because of this, if you have a reference to the original object in the datasource (say when you are binding to it), the reference will still work after the new version has been pushed in. This allows the complete object to be bounced around the intertubes or wherever and only update existing objects rather than creating new references all the time.

**changeInfo**: 
  - source: 'user' or 'server' (also available: 'cache', 'database' which like server, bypass the change filters other than the base match)
  - any other metadata that we may want to access further down stream.

### datasource.query(query, context, options)

Queries the data stored using [JSON Query](https://github.com/mmckegg/json-query) and returns an object representing the result and other useful info (especially when doing databinding)

**context**: (optional) specifiy a target for `.` queries to get their data. This is used when matcher queries execute (e.g. `item`) and is set to the new object being pushed and great when using repeaters when template/data binding.

**options**: additional options to be passed to the inner JSON Query.

Returns an object with the following keys:
  - value: the result of the query
  - parents: a list of parent objects and the keys that lead to the next layer
  - references: an array of objects that if changed would invalidate the result of the query - we can use this to add binding metadata.
  - key: the array index or key of the resulting value

### datasource.get(query, context, options)

A shortcut for datasource.get(...).value - exactly the same, but only returns the value of the query, not the other info.

### datasource.on('change', function(object, changeInfo))

The datasource emits a change event every time a pushed object is matched. The changeInfo contains the infomation supplied from [JSON Change Filter](https://github.com/mmckegg/json-change-filter) including `action`, `matcher`, and `original`. This can be used to determine when to update bound elements, etc.

## Matchers

Matchers are a collection of filters and queries that explain what to do with incoming objects. 

- ref: give the matcher a unique name so it can be refered to (optional)
- item: a query specifying how to find existing object and where to put the object if no collection was specified. 
- collection: a query specifying the collection the object will be added to (optional)
- collectionKey: Specify a query to use to generate the objects key if the collection is not an array, but rather an object - good for building lookups (optional)
- match: This filter is checked using `jsonChangeFilter.check` to see if resposible for the object or not. It the change will be allowed if source is `server` or `database`. Otherwise the allow queries must pass. If no allow queries are specified, `user` changes will not be accepted. (required)
- allow: (all optional) - each option takes either a single query or array
  - change: All queries must return `true` for all types of changes. 
  - append: If the object is being appended, only allow if the specified queries return `true`.
  - update: If the object is being updated (an original was found), only allow if the specified queries return `true`.
  - remove: If the object is being updated (has `_deleted: true`), only allow if the specified queries return `true`.


Here's a simple matcher that will save any incoming object with the ID of 'abc123' and the type 'post' into the key 'current_post'.

```js
{
  match: {
    id: 'abc123',
    type: 'post'
  }
  item: 'current_post'
}
```

This one stores a collection of all users. If a new user is pushed in, will be stored, if an existing user is passed in, the original will be updated to match the attributes of the object.

```js
{
  match: {
    type: 'user'
  }
  item: 'users[id={.id}]',
  collection: 'users'
}
```

To make things a little more interesting, this example groups tasks by `heading_id`, and allows tasks to be added, updated, removed, or moved to another heading, but only allows the user to specify certain fields and requires them to assign their own user_id (we'll use our own custom allow queries to do this).

```js
var filters = {
  allowChange: function(input, params){
    if (input.action === 'remove'){
      return true
    } else {
      return check(changeInfo, {
        equal: {user_id: params.data.current_user_id},
        changes: ['optional_field'],
        required: ['heading_id', 'description'],
        appendChanges: ['new_item_field']
      })
    }
  }
}

var data = {
  current_user_id: 123
}

var matchers = [
  { match: {
      type: 'task'
    },
    allow: {
      change: ':allowChange'
    },
    item: 'tasks_by_heading[][id={.id}]',
    collection: 'tasks_by_heading[{.heading_id}]'
  }
]

var context = jsonContext(data, {dataFilters: filters, matchers: matchers})

function check(changeInfo, options){
  var changeKeys = [].concat(options.changes).concat(options.required)
  if (options.required && !checkRequired(options.required, changeInfo)){
    return false
  }
  if (options.changes && !checkChanges(changeKeys, changeInfo, options.appendChanges)){
    return false
  }
  if (options.equal && !checkEqual(options.equal, changeInfo)){
    return false
  }
  return true
}

function checkRequired(required, changeInfo){
  return required.every(function(key){
    return !!changeInfo.object[key]
  })
}
function checkChanges(allowed, changeInfo, appendExceptions){
  return Object.keys(changeInfo.changes).every(function(key){
    return !!~allowed.indexOf(key) || (appendExceptions && !!~appendExceptions.indexOf(key))
  })
}
function checkEqual(equal, changeInfo){
  return Object.keys(equal).every(function(key){
    return changeInfo.object[key] == equal[key]
  })
}
```

## Databinding

The best way to handle data binding with JSON Context is using $meta attributes on the objects, then linking back to the object from the dom-node. 

When objects are updated, JSON Context ignores any attribute that starts with `$` and will leave in place. What this means is you can use them for storing metadata about an object. Even after the object is updated by `pushChange` the meta data will still be there. 

The only way a '$' key can get lost is if the item is removed. Makes them great for storing binding info.

### Basic example (don't try this at home variety)

(instead use [Realtime Templates](https://github.com/mmckegg/realtime-templates))

```js
var datasource = require('json-context')({
  comments: [
    {id: 1, type: 'comment', name: 'Matt', body: 'Hello test 123'}
  ]
}, {
  matchers: [
    { 
      match: {type: 'comment'},
      allow: {
        update: true,
        append: true
      }
      item: 'comments[id={.id}]',
      collection: 'comments'
    }
  ],
  dataFilters: {}
})

datasource.on('change', function(object, changeInfo){
  if (changeInfo.action === 'update'){
    object.$boundElements && object.$boundElements.forEach(function(element){
      var queryResult = datasource.query(element.getAttribute('data-bind'))
      element.innerHTML = escapeHtml(queryResult.value)
    })
  } else if (changeInfo.action === 'remove'){
    ...
  } else if (changeInfo.action === 'update'){
    ...
  }
})

var elementsToBind = document.querySelectorAll('[data-bind]')

elementsToBind.forEach(function(element){
  var queryResult = element.getAttribute('data-bind')
  element.innerHTML = escapeHtml(queryResult.value)

  queryResult.references.forEach(function(reference){
    reference.$boundElements = reference.$boundElements || []
    reference.$boundElements.push(element)
  })

})
```