//TODO: test events and pipes
//TODO: test change filters

var assert = require('assert')

var jsonContext = require('./json-context')

var data = {
  post: {
    _id: 'abc123',
    type: 'post',
    title: "A Blog Post",
    description: "Testing a blog post",
    body: "It works!",
    date: 1333677084216
  },
  
  users: {
    'abc234': {
      _id: 'abc234',
      type: 'user',
      name: 'Matt McKegg',
      role: 'admin'
    }
  },
  
  current_user_id: 'abc234',
  
  comments: [
    {
      _id: 'cba123',
      type: 'comment',
      user_id: null,
      post_id: 'abc123',
      anonymous_user: {name: 'Steve', email: 'steve@anonymous.org'}, // of course only include the email if current user is admin
      body: "Your site's so fast! Want to exchange links?"
    },
    {
      _id: 'cba234',
      type: 'comment',
      user_id: 'abc234', // happens to be the ID of the admin user -- see users above
      post_id: 'abc123',
      body: "Thanks, it's because I'm using Node.js with JSON Context. Sorry, I don't want to link to your site because it's built with php..."
    }
  ]
}

var matchers = [

  { // subscribe to changes on blog post
    filter: {
      match: {
        _id: 'abc123',
        type: 'post'
      }
    },
    item: 'post' // a JSON Query telling where to update
  },
  
  { // subscribe to comments (both new and updates)
    filter: {
      match: {
        post_id: 'abc123',
        type: 'comment'
      }
    },
    item: 'comments[_id={._id}]',   // a JSON Query telling where to find item to update
    collection: 'comments'          // a JSON Query telling where to add new items
  },
  
  
  { // subscribe to users (maybe I might change my name or something?)
    filter: {
      match: {
        type: 'user'
      }
    },
    item: 'users[{._id}]',  // JSON Query: where to find item to update
    collection: 'users',    // JSON Query: where to add new items
    collectionKey: '._id'   // as the collection in this case is not an array, what should it's key be?
  }
  
]


var tests = [
  
  function(data, context){p( "Test remote append to array collection" )
    
    var newComment = {_id: 'comment1', type: 'comment', post_id: 'abc123', user_id: null, anonymous_user: {name: "Bill Gates"}, body: "Here's $10000, have a nice day!"}
    var comments = data.comments
    
    assertItemAdded(comments, function(){
      context.pushChange(newComment, {source: 'remote'})
      assert.equal(lastFrom(comments), newComment)
    })
    
  },
  
  function(data, context){p( "Test remote append non matching comment -> should ignore item" )
    
    var newComment = {_id: 'comment1', type: 'comment', post_id: 'unknown', user_id: null, anonymous_user: {name: "Free Money"}, body: "SPAM! SPAM! SPAM!"}
    var comments = data.comments
    
    assertItemNotAdded(comments, function(){
      context.pushChange(newComment, {source: 'remote'})
      assert.notEqual(lastFrom(comments), newComment)
    })
    
  },
  
  function(data, context){p( "Test remote update single item without collection -> should still be same reference obj but new content" )
    
    var changedPost = {_id: 'abc123', type: 'post', title: 'New title', body: "SPAM! SPAM! SPAM!"}
    var post = data.post
    
    context.pushChange(changedPost, {source: 'remote'})
    
    var updatedPost = context.get('post')
    
    assert.deepEqual(updatedPost, changedPost)
    assert.notEqual(updatedPost, changedPost)
    
    assert.equal(post, updatedPost)
    
  },
  
  function(data, context){p( "Test delete item from collection" )
    
    var changedComment = {_id: 'cba123', type: 'comment', post_id: 'abc123', _deleted: true}
    var comment = context.get('comments[_id={._id}]', changedComment)
    
    assertItemRemoved(data.comments, function(){
      context.pushChange(changedComment, {source: 'remote'})      
    })
    
    assert.equal(context.get('comments[_id={._id}]', changedComment), null)
    
  }
  
]



function assertItemAdded(collection, func){
  var length = collection.length
  func()
  assert.equal(collection.length, length + 1, "Item was not added")
}

function assertItemRemoved(collection, func){
  var length = collection.length
  func()
  assert.equal(collection.length, length - 1, "Item was not removed")
}

function assertItemNotAdded(collection, func){
  var length = collection.length
  func()
  assert.equal(collection.length, length, "Item was added when it shouldn't")
}

var jsonData = JSON.stringify(data)
tests.forEach(function(test){
  var data = JSON.parse(jsonData)
  var context = jsonContext(data, {matchers: matchers})
  test(data, context)
})

function p(text){
  console.info(text)
}

function lastFrom(array){
  return array[array.length-1]
}