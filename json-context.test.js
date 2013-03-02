//TODO: test events and pipes
//TODO: test change filters

var test = require('tap').test

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
    match: {
      _id: 'abc123',
      type: 'post'
    },
    item: 'post' // a JSON Query telling where to update
  },
  
  { // subscribe to comments (both new and updates)
    match: {
      post_id: 'abc123',
      type: 'comment'
    },
    item: 'comments[_id={._id}]',   // a JSON Query telling where to find item to update
    collection: 'comments'          // a JSON Query telling where to add new items
  },
  
  
  { // subscribe to users (maybe I might change my name or something?)
    match: {
      type: 'user'
    },
    item: 'users[{._id}]',  // JSON Query: where to find item to update
    collection: 'users',    // JSON Query: where to add new items
    collectionKey: '._id'   // as the collection in this case is not an array, what should it's key be?
  }
  
]

function runTests(){

  test("Server append to array collection", function(t){
    freshData(function(data, context){
      
      var newComment = {_id: 'comment1', type: 'comment', post_id: 'abc123', user_id: null, anonymous_user: {name: "Bill Gates"}, body: "Here's $10000, have a nice day!"}
      var comments = data.comments
      
      assertItemAdded(t, comments, function(){
        context.pushChange(newComment, {source: 'server'})
        t.equal(lastFrom(comments), newComment)
      })
      
      t.end()
    })
  })  
  
  test("Server append non matching comment -> should ignore item", function(t){
    freshData(function(data, context){
      
      var newComment = {_id: 'comment1', type: 'comment', post_id: 'unknown', user_id: null, anonymous_user: {name: "Free Money"}, body: "SPAM! SPAM! SPAM!"}
      var comments = data.comments
      
      assertItemNotAdded(t, comments, function(){
        context.pushChange(newComment, {source: 'server'})
        t.notEqual(lastFrom(comments), newComment)
      })
      
      t.end()
    })
  })
  
  test("Server update single item without collection -> should still be same reference obj but new content", function(t){
    freshData(function(data, context){
      
      var changedPost = {_id: 'abc123', type: 'post', title: 'New title', body: "SPAM! SPAM! SPAM!"}
      var post = data.post
      
      context.pushChange(changedPost, {source: 'server'})
      
      var updatedPost = context.get('post')
      
      t.deepEqual(updatedPost, changedPost)
      t.notEqual(updatedPost, changedPost)
      
      t.equal(post, updatedPost)
      
      t.end()
    })
  })
    
  test("Delete item from collection", function(t){
    freshData(function(data, context){
      
      var changedComment = {_id: 'cba123', type: 'comment', post_id: 'abc123', _deleted: true}
      var comment = context.get('comments[_id={._id}]', changedComment)
      
      assertItemRemoved(t, data.comments, function(){
        context.pushChange(changedComment, {source: 'server'})      
      })
      
      t.equal(context.get('comments[_id={._id}]', changedComment), null)
      
      t.end()
    })
  })

}


function assertItemAdded(t, collection, func){
  var length = collection.length
  func()
  t.equal(collection.length, length + 1, "Item should be added")
}

function assertItemRemoved(t, collection, func){
  var length = collection.length
  func()
  t.equal(collection.length, length - 1, "Item should be removed")
}

function assertItemNotAdded(t, collection, func){
  var length = collection.length
  func()
  t.equal(collection.length, length, "Item shouldn't be added")
}

var jsonData = JSON.stringify(data)
function freshData(func){
  var data = JSON.parse(jsonData)
  var context = jsonContext(data, {matchers: matchers})
  func(data, context)
}

function p(text){
  console.info(text)
}

function lastFrom(array){
  return array[array.length-1]
}

runTests()