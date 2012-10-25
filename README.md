# JSON Context

This module allows a server to create a JSON Context - single object that supports querying and contains all data required to render a view/page. When sent to the client it also provides an event stream for syncing with server and data-binding.

It is intended to be used in conjunction with the modules [Realtime Templates](https://github.com/mmckegg/node-realtime-templates) and [JSON Syncer](https://github.com/mmckegg/node-json-syncer), however can be used standalone if that's what you're into.

## Work in progress

None of this stuff is up on NPM yet...

## AJAX is so 2005...

We don't want to wait for loading. **Ajax makes you wait all the time.**

What we need is instant. After I load a page, everything should be able to be accessed instantly. If something changes after I load the page, that should be magically pushed to me... I shouldn't have to ask for it, and I shouldn't have to wait for it.

The only time that loading is acceptable is when switching contexts - i.e. switching jobs/clients/projects/posts/pages. But it needs to be major to justify a load - because in that case we're used to it. It's called loading a web page. Browsers were designed to work this way ... none of this "Please watch this fancy Ajax loading graphic while I waste your time loading stuff I should have already had ready for you".. and no more parts of the page still loading etc.

## JSON Context Is A New Way To Write Data-Backed Sites

The first step is deciding **all of the data needed to render a page** and the most efficient structure for that data. This is as simple as building a JSON object.

```js
  
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
```

The data can come from anywhere... Mysql, CouchDB, JSON files ... it's up to you. It just needs to be clearly identifiable. Normally this means each item needs to have a unique ID.

### On The Server

Once we have the data we need nicely packaged up in a single JSON object, it's time to use that data to render our web page.

Here's a stupid simple template example using **embedded js (ejs)**.... Don't try this at home (instead use [Realtime Templates](https://github.com/mmckegg/node-realtime-templates))

```html

  <h1 id='post_title'><%= post.title %></h1>
  <div id='post_body'><%= post.body %></div>
  
  <h2>Comments</h2>
  <div id='comments'> 
    <% comments.forEach(function(comment){ %>
      
      <div id='comment_<%= comment.id %>'>
        <h3 class='name'><%= (users[comment.user_id] || comment.anonymous_user).name %></h3>
        <div class='body'><%= comment.body %></div>
      </div>
      
    <% }) %>
  </div>
```

Make sure to include the data on the page. Here we use [Browserify](https://github.com/substack/node-browserify) to require the browser version of `jsonContext` (just like we would in our Node.js code). This creates a wrapper around our data that lets us query it, push changes to it, and get events when things change (for data binding).

```html
  <script src='/browserify.js'></script>
  <script>
    window.context = require('json-context')(<%= JSON.stringify(data) %>)
  </script>
```

### On The Client (browser in this case)

So far so good, the browser has rendered the page. Nothing new here. But now we have access to **all of the data** the server used to render the page.

In this example we tribute the good old days of the internet... where sites were friendly and **popup alerts** were cool.

```js

  var userName = window.context.get("users[{current_user_id}].name")
  alert('Hi ' + userName + ', welcome to my blog!!')
```

That was an example of using [JSON Query](https://github.com/mmckegg/node-json-query) which is *included for free* with every JSON Context. You can use it to pluck single values or **nested queries** like we see above. `current_user_id` is one query and the result is inserted into the outer query to end up with something that looks like `users[abc234].name` which is then run against the original data we provided.

#### OK, so what happens when the data changes on the server?

Nothing, yet. So far this is all pretty useless, apart from keeping your templates nicely organized (no code should be in your templates, etc).

What we need to do is somehow wire up a change stream from the server to the client. [Shoe](https://github.com/substack/shoe) is an excellent choice for this. 


### Back on the server

Here is an example change subscription service using [Shoe](https://github.com/substack/shoe):

```js

  var subscribers = []
  var shoe = require('shoe')
  
  var publisher = shoe(function(stream){
    
    // add the subscription
    subscribers.push(stream)
    
    stream.on('end', function () {
      // remove the subscription
      var index = subscribers.indexOf(stream)
      subscribers.splice(index, 1)
    });
    
  })
  
  
  function pushChange(object){
    var data = JSON.stringify(object)
    subscribers.forEach(function(stream){
      stream.write(data + '\n')
    })
  }
  
  publisher.install(httpServer, '/changes')
  
```

Let's hook in to the CouchDB changes feed using [Follow](https://github.com/iriscouch/follow) and push every change.

```js
  var follow = require('follow');
  follow({db: "http://localhost:5984/blog", include_docs: true}, function(err, change) {
    if(!err){
      pushChange(change.doc)
    }
  })
```

### Now it's time to subscribe on the client

The part we've all been waiting for. Let's make this site work in realtime!

Once again let's use [Browserify](https://github.com/substack/node-browserify) to pull in the browser version of [Shoe](https://github.com/substack/shoe)

```js

  // client-side require using browserify
  var shoe = require('shoe')
```

And connect to the publisher we set up on the server (using [split](https://github.com/dominictarr/split) to ensure we receive whole lines):

```js

  var split = require('split')
  
  shoe('/changes').pipe(split()).on('data', function(line){
    window.context.pushChange(JSON.parse(line), {source: 'server'})
  })

```

#### So what's this `pushChange` thing?

This is where things start to get interesting. Let's back up a little and add a few things to our original data object.

```js
  
  var data = {
    post: {
      _id: 'abc123'
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
    comments: [...],
    
    // new stuff here!
    $matchers: [
      
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
  }
```

Whenever a JSON Context object receives a `pushChange` command, it runs the new change against every matcher stored in `data._matchers` using [JSON Change Filter](https://github.com/mmckegg/node-json-change-filter).

It uses this information to update the local context (`window.context`) and generates events describing how it modified the data so that we know what to change in the DOM.

### Let's bind our context to our DOM

So now that we have our little pub/sub going on, all changes made to the database are automatically updating the relevant parts of our local context (`window.context`).

Let's tell the post elements how to automatically update if needed (by extending the dom with some hack functions):

```js
  
  var postTitleElement = document.getElementById('post_title')
  postTitleElement.update = function(object){
    postTitleElement.innerHTML = object.title //this should really be html escaped...
  }
  
  var postBodyElement = document.getElementById('post_body')
  postBodyElement.update = function(object){
    postBodyElement.innerHTML = object.body
  }
  
  // add some metadata to the post showing what elements should be refreshed when the post changes
  var post = window.context.get('post')
  post.$elements = [postTitleElement, postBodyElement]

```

And now comments:

```js
  
  function generateCommentElement(comment){
    // code to create and return a new DOM element based on the new object
  }

  var commentsElement = document.getElementById('comments')
  commentsElement.append = function(object){
    commentsElement.appendChild(generateCommentElement(object))
  }
  
  var comments = window.context.get('comments')
  comments.$collectionElements = [commentsElement]
  
  // loop over all comments in the context and bind to each
  comments.forEach(function(comment){
    
    var commentElement = commentsElement.getElementById('comment_' + comment.id)
    commentElement.update = function(){
      var commentNameElement = commentElement.getElementsByClassName('name')
      var user = window.context.get('users[?]', comment.user_id) || comment.anonymous_user
      commentNameElement.innerHTML = user.name
      
      var commentBodyElement = commentElement.getElementsByClassName('body')
      commentBodyElement.innerHTML = comment.body
      
    }
    
    comment.$elements = [commentElement]
  })
```

### What's with the '$' keys?

In case you're wondering about the '$' keys (e.g. `$elements`) - there's nothing special about these, except that they are ignored by the updater and left in place. What this means is you can use them for storing metadata about an object. Even after the object is updated by `pushChange` the meta data will still be there. 

The only way a '$' key can get lost is if the item is removed. Makes them great for storing binding info.

#### But this still won't actually do anything yet

We need to subscribe to the `change` event on `window.context`

```js
  
  window.context.on('change', function(object, changeInfo){
  
    if (changeInfo.action === 'append'){
      
      ;(changeInfo.collection.$collectionElements || []).forEach(function(collectionElement){
        collectionElement.append && collectionElement.append(object)
      })
      
    } else if (changeInfo.action === 'remove'){
      
      ;(object.$elements || []).forEach(function(element){
        element.parentNode.removeChild(element)
      })
      
    } else if (changeInfo.action === 'update'){
      ;(object.$elements || []).forEach(function(element){
        element.update && element.update(object)
      })
    }
    
  })
  
```

## WOW OMG!! EVERYTHING WORKS IN REALTIME!!! IT'S MAGIC!!

No it's not. You did all the work. JSON Context is just one tool that made it easier.

Here are some more tools to make it even easier:

  - [JSON Syncer](http://github.com/mmckegg/node-json-syncer) - Handles all of the change pushing between server and client. Allows subscribing to only specific events - no need to overload every user with every little thing no matter how irrelevant. Also provides a way to send the user's changes back to the server.
  - [Realtime Templates](http://github.com/mmckegg/node-realtime-templates) - This is where it all comes together. Write your views in 100% pure HTML markup. You can bind elements using JSON Query to your context, and create repeating areas, conditionals, partials, and much more. The server renders the initial page, but best part is that the view is automatically shared with the browser so **you don't need to write a single line of refresh code**. The view already knows how to update itself. Things start to actually be magic at this point.
