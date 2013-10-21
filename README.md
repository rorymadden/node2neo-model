# Node2Neo Model

Model support for Node2Neo. This module builds upon the node2neo family of modules.
A model uses a node2neo-schema, but can be used independently if required.

NOTE: Neo4j 2.0 is required.

## Usage

#### Create a new model

```js
var db = require('node2neo')('http://localhost:7474');
var Model = require('node2neo-model');

Var schema = {
  first: {type: String, required: true},
  email: {type:String, required: true, index: true},
  birthday: Date
}

var User = Model.model('User', schema);

User.create({first: 'Name', email: 'test@test.com'}, function(err, user){
  ...
})
```
The first step in the creation of a model is to validate that the data passed in matches the structure defined in the schema. THis reduces teh need to perform checking of input data in your code!


The structure of the create function is .create(data, options, callback);
Often when creating a model you want to create a relationship to another object. You can pass in a relationship object to the optional options object.

```js
var relationship = {
  indexField: 'email',
  indexValue: 'test@test.com',
  type: 'FRIEND',
  direction: 'to',
  data: {
    optional: true
  }
}
User.create({first: 'Other', email: 'other@test.com'}, {relationship: relationship}, function(err, results){
  // results.node = the newly created node
  // results.rel = the newly created relationship
});
```

#### Update a model
To update a model you need an instance of the existing model. There are three ways to update a model: findByIdAndUpdate, findOneAndUpdate or update.

```js
User.findByIdAndUpdate(id, updates, options, callback){
  // finds the model and then calls User.update with the model

});

User.findOneAndUpdate(conditions, updates, options, callback){
  // finds the model and then calls User.update with the model

});

User.update(model, updates, options, callback){

});
```

Again the updates are validated against the schema definitions.


#### Transactions
The options argument can be used to pass in transactions as well. Transactions let you perform multiple operations with a single atomic transaction. This is useful where you have multiple all-or-nothing statemetns that you want to run.

There are issues with the database locking if two transactions attempt to update the same node so be careful.

NOTE: You cannot create and update a model in the same transaction as the node does not exist in the database until the complete transaction has been committed.

```js
var Transaction = new Transaction(db);

var trans1 = new Transaction;
trans1.begin(function(err){
  User.create(data, {transaction: trans1}, function(err, user){
    Event.create(data, {transaction: trans1}, function(err, event){
      Other.update(model, updates, {transaction: trans1}, function(err, other){
        trans1.commit(function(err){
          // all or nothing commit
        })
      });
    });
  });
});
```

#### Remove a node
To remove a node simply pass its id to the remove function. The options object can contain a force option. Removing a node in Neo4j will fail if it has any relationships. The force option deletes the node and all relationships that the node has.

When removing nodes be carefult not to leave orphan nodes - remove does not cascade.

```js
User.remove(id, {force: true}, function(err){

})
```

#### Find
To find a node you can use the find method.

Find returns an array of nodes and includes an _id field to enable easy referencing of the node.

```js
User.find({email: 'test@test.com'}, function(err, user){

})

// the returned format
[{
  _id: 17534,
  first: 'Name',
  email: 'test@test.com'
}]
'''js

You can pass optional parameters to find:
  - limit: limit the number of results
  - skip: skip the x number of initial results
  - orderBy: sort the results e.g. orderBy: [{field: 'first', desc:true, nulls:true}]
  - using: define teh index to use in the lookup

#### Find One
Find returns an array of nodes. However if you know you only want one result you can use findOne. This method does not validate that there is only one result though, if there are multiple results only the first result will be returned.

```js
User.findOne({email: 'test@test.com}, function(err, user){

})
```

If no node is found node the returned object will be undefined:
```js
User.findOne({email: 'test@test.com, name: 'Test'}, function(err, user){
  // user === undefined
});
```

#### Find By Id
```js
User.findById(id, function(err, user){
  // if not a valid id user === unndefined
});
```

### Get Relationships
If you want to find all of the relationships from a node and the related nodes you can use the getRelationships method.

The getRelationships method takes the id of the starting node, and some optional conditions and options.

Conditions include:
  - types: single relationship type or array of types to be returned
  - direction: 'to' or 'from'. Leave blank for both
  - label: the single label to return e.g. User
  - nodeConditions: key:value query conditions to match data on the related nodes
  - relConditions: key:value query conditions to match data on the relationship

The options object is the same as the find options:
  - limit: limit the number of results
  - skip: skip the x number of initial results
  - orderBy: sort the results e.g. orderBy: [{field: 'first', desc:true, nulls:true}]
  - using: define teh index to use in the lookup

```js
User.getRelationships(208, {label: 'Cookies', types: 'Authorises'}, function(err, results){
  // results is an object with nodes and rels arrays

  // each node includes an _id and _nodeType variable. _nodeType includes the label of the node

  // each rel includes _id, type, direction and data. Direction is 'to or 'from'. type is the relationship type, and data contains any data on the relationship.
});
```

##Licence
MIT