var testDatabase = require('./util/database');
var db = require('node2neo').db(testDatabase.url);
var Model = require('../')(db);
var Transaction = require('node2neo-transactions');
var Schema = require('node2neo-schema');

var should = require('chai').should();
var assert = require('assert');
var sinon = require('sinon');

var User, rootUserId, secondId, relId, userData, eventSpy, uniqueName;


describe("model", function(){
  // this.timeout(0);

  before(testDatabase.refreshDb);
  after(testDatabase.stopDb);
  it("should create a new model with no schema", function(done){

    var Mod = Model.model('model');
    should.exist(Mod.schema);
    done();
  });
  it("should create a new model with a schema: with indexes", function(done){
    var schema = {
      first_name: {type: String, required: true},
      last_name: {type: String, required: true},
      email: {type: String, required: true, unique: true}
    };
    var User4 = Model.model('User4', schema);
    should.exist(User4.schema);
    User4.schema._constraints.should.contain('email');
    User4.schema._indexes.length.should.equal(0);
    done();
  });
  describe("model instance", function(){
    before(function(done){
      userData = {
        first_name: '  Rory   ',
        last_name: '  Madden  ',
        email: 'rorymadden@gmail.com'
      };

      var emailRegEx = /^(?:[\w\!\#\$\%\&\'\*\+\-\/\=\?\^\`\{\|\}\~]+\.)*[\w\!\#\$\%\&\'\*\+\-\/\=\?\^\`\{\|\}\~]+@(?:(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-](?!\.)){0,61}[a-zA-Z0-9]?\.)+[a-zA-Z0-9](?:[a-zA-Z0-9\-](?!$)){0,61}[a-zA-Z0-9]?)|(?:\[(?:(?:[01]?\d{1,2}|2[0-4]\d|25[0-5])\.){3}(?:[01]?\d{1,2}|2[0-4]\d|25[0-5])\]))$/;
      var schema = {
        first_name: {type: String, required: true, trim:true},
        last_name: {type: String, required: true, trim: true, lowercase:true},
        email: {type: String, required: true, match:emailRegEx, unique: true}
      };
      User = Model.model('User', schema);
      done();
    });
    it("should create a new node", function(done){
      var user = {
        first_name: 'Rory',
        last_name: 'Madden',
        email: 'rorymadden@gmail.com'
      };
      eventSpy = sinon.spy();
      User.schema.on('create', eventSpy);
      User.create(user, function(err, results){
        should.not.exist(err);
        should.exist(results._id);
        rootUserId = results._id;
        should.exist(results);
        results.first_name.should.equal('Rory');
        results.last_name.should.equal('madden');
        results.email.should.equal('rorymadden@gmail.com');
        should.not.exist(results.rel);
        assert(eventSpy.called, 'Event did not fire.');
        assert(eventSpy.calledOnce, 'Event fired more than once');
        eventSpy.alwaysCalledWithExactly(results).should.equal(true);
        done();
      });
    });
    it("should update a node: by id", function(done){
      var updates = {
        first_name: 'Roger'
      };
      eventSpy = sinon.spy();
      User.schema.on('update',eventSpy);
      User.findByIdAndUpdate(rootUserId, updates, function(err, results){
        should.not.exist(err);
        results._id.should.equal(rootUserId);
        should.exist(results);
        results.first_name.should.equal('Roger');
        results.last_name.should.equal('madden');
        results.email.should.equal('rorymadden@gmail.com');
        should.not.exist(results.rel);
        assert(eventSpy.called, 'Event did not fire.');
        assert(eventSpy.calledOnce, 'Event fired more than once');
        eventSpy.alwaysCalledWithExactly(results, updates).should.equal(true);
        done();
      });
    });
    it("should update a node: by conditions", function(done){
      var time = Date.now().toString();
      var updates = {
        first_name: 'Mary'
      };
      eventSpy = sinon.spy();
      User.schema.on('update',eventSpy);
      User.findByIdAndUpdate(rootUserId, {first_name: time}, function(err, results){
        should.not.exist(err);
        User.findOneAndUpdate({first_name: time}, updates, function(err, results){
          should.not.exist(err);
          results._id.should.equal(rootUserId);
          should.not.exist(err);
          should.exist(results);
          results.first_name.should.equal('Mary');
          results.last_name.should.equal('madden');
          results.email.should.equal('rorymadden@gmail.com');
          should.not.exist(results.rel);
          assert(eventSpy.called, 'Event did not fire.');
          assert(eventSpy.calledTwice, 'Event should have fired twice');
          // eventSpy.alwaysCalledWithExactly(results, updates).should.equal(true);
          done();
        });
      });
    });
    it("should create a new node with a relationship", function(done){
      var user = {
        first_name: 'Cath',
        last_name: 'Fee',
        email: 'other@gmail.com'
      };
      var relationship = {
        indexField: '_id',
        indexValue: rootUserId,
        nodeLabel: 'User',
        direction: 'to',
        type: 'ENGAGED_TO'
      }
      eventSpy = sinon.spy();
      User.schema.on('create',eventSpy);
      User.create(user, {relationship: relationship}, function(err, results){
        should.not.exist(err);
        should.exist(results.node);
        should.exist(results.node._id);
        secondId = results.node._id;
        results.node.first_name.should.equal('Cath');
        results.node.last_name.should.equal('fee');
        results.node.email.should.equal('other@gmail.com');
        should.exist(results.rel);
        results.rel.type.should.equal('ENGAGED_TO');
        assert(eventSpy.called, 'Event did not fire.');
        assert(eventSpy.calledOnce, 'Event fired more than once');
        eventSpy.alwaysCalledWithExactly(results).should.equal(true);
        done();
      });
    });
    it("should create a new relationship", function(done){
      var relationship = {
        from: rootUserId,
        to: secondId,
        type: 'FRIEND',
        data: {
          since: 'forever'
        }
      };
      User.createRelationship(relationship, function(err, rel){
        should.not.exist(err);
        rel._id.should.be.a('number');
        relId = rel._id;
        rel.type.should.equal('FRIEND');
        rel.rel.since.should.equal('forever');
        done();
      });
    });
    it("should remove a relationship", function(done){
      User.removeRelationship(relId, function(err){
        should.not.exist(err);
        done();
      });
    });
    it("should remove a node", function(done){
      eventSpy = sinon.spy();
      User.schema.on('remove',eventSpy);
      User.remove(rootUserId, function(err){
        // has relationships
        should.exist(err);
        User.remove(rootUserId, {force: true}, function(err){
          should.not.exist(err);
          User.findById(rootUserId, function(err, node){
            should.exist(err);
            err[0].code.should.equal(42000);
            err[0].message.should.contain('Node with id');
            should.not.exist(node);
            assert(eventSpy.called, 'Event did not fire.');
            assert(eventSpy.calledOnce, 'Event fired more than once');
            eventSpy.alwaysCalledWithExactly(rootUserId).should.equal(true);
            done();
          });
        });
      });
    });
    // it("should create hooks", function(done){
    //   User.pre('create', function(next, user, options, callback){
    //     user.first_name = 'blue';
    //     next(user, options, callback);
    //   });
    //   var user = {
    //     first_name: 'Rory',
    //     last_name: 'Madden',
    //     email: 'rorymadden@gmail.com'
    //   };
    //   User.create(user, function(err, results){
    //     should.not.exist(err);
    //     done();
    //   });
    // });
  });
  describe("model transactions", function(){
    before(function(done){
      userData = {
        first_name: '  Rory   ',
        last_name: '  Madden  ',
        email: 'rorymadden@gmail.com'
      };

      var emailRegEx = /^(?:[\w\!\#\$\%\&\'\*\+\-\/\=\?\^\`\{\|\}\~]+\.)*[\w\!\#\$\%\&\'\*\+\-\/\=\?\^\`\{\|\}\~]+@(?:(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-](?!\.)){0,61}[a-zA-Z0-9]?\.)+[a-zA-Z0-9](?:[a-zA-Z0-9\-](?!$)){0,61}[a-zA-Z0-9]?)|(?:\[(?:(?:[01]?\d{1,2}|2[0-4]\d|25[0-5])\.){3}(?:[01]?\d{1,2}|2[0-4]\d|25[0-5])\]))$/;
      var schema = {
        first_name: {type: String, required: true, trim:true},
        last_name: {type: String, required: true, trim: true, lowercase:true},
        email: {type: String, required: true, match:emailRegEx, unique: true}
      };
      User = Model.model('User', schema);
      done();
    });
    it("should create a new node with a transaction", function(done){
      eventSpy = sinon.spy();
      User.schema.on('create',eventSpy);
      var trans = new Transaction(db);
      // trans.on('create',eventSpy);
      trans.begin(function(err){
        should.not.exist(err);
        User.create(userData, {transaction: trans}, function(err, result){
          trans.commit(function(err2, response){
            should.not.exist(err);
            should.not.exist(err2);
            result._id.should.be.a('number');
            rootUserId = result._id;
            result.first_name.should.equal('Rory');
            response.length.should.equal(0);
            assert(eventSpy.called, 'Event did not fire.');
            assert(eventSpy.calledOnce, 'Event fired more than once');
            eventSpy.alwaysCalledWithExactly(result).should.equal(true);
            done();
          });
        });
      });
    });
    it("should update a node with a transaction: findByIdAndUpdate", function(done){
      uniqueName = Date.now().toString();
      eventSpy = sinon.spy();
      User.schema.on('update',eventSpy);
      var trans = new Transaction(db);
      trans.begin(function(err){
        should.not.exist(err);
        var updates = {first_name: uniqueName};
        User.findByIdAndUpdate(rootUserId, updates, {transaction: trans}, function(err, result){
          trans.commit(function(err2, response){
            should.not.exist(err);
            should.not.exist(err2);
            result._id.should.be.a('number');
            result._id.should.equal(rootUserId);
            result.first_name.should.equal(uniqueName);
            response.length.should.equal(0);
            assert(eventSpy.called, 'Event did not fire.');
            assert(eventSpy.calledOnce, 'Event fired more than once');
            eventSpy.alwaysCalledWithExactly(result, updates).should.equal(true);
            done();
          });
        });
      });
    });
    it("should update a node with a transaction: findOneAndUpdate", function(done){
      eventSpy = sinon.spy();
      User.schema.on('update',eventSpy);
      var trans = new Transaction(db);
      trans.begin(function(err){
        should.not.exist(err);
        var updates = {first_name: 'Mary'};
        User.findOneAndUpdate({first_name: uniqueName}, updates, {transaction: trans}, function(err, result){
          trans.commit(function(err2, response){
            should.not.exist(err);
            should.not.exist(err2);
            result._id.should.be.a('number');
            result._id.should.equal(rootUserId);
            result.first_name.should.equal('Mary');
            response.length.should.equal(0);
            assert(eventSpy.called, 'Event did not fire.');
            assert(eventSpy.calledOnce, 'Event fired more than once');
            eventSpy.alwaysCalledWithExactly(result, updates).should.equal(true);
            done();
          });
        });
      });
    });
    it("should create a node with a relationship within a transaction", function(done){
      eventSpy = sinon.spy();
      User.schema.on('create',eventSpy);

      var relationship = {
        indexField: '_id',
        indexValue: rootUserId,
        nodeLabel: 'User',
        direction: 'to',
        type: 'ENGAGED_TO'
      };

      var trans = new Transaction(db);
      trans.begin(function(err){
        should.not.exist(err);
        User.create(userData, {transaction: trans, relationship: relationship}, function(err, result){
          trans.commit(function(err2, response){
            should.not.exist(err);
            should.not.exist(err2);
            result.node._id.should.be.a('number');
            secondId = result.node._id;
            result.node.first_name.should.equal('Rory');
            response.length.should.equal(0);
            assert(eventSpy.called, 'Event did not fire.');
            assert(eventSpy.calledOnce, 'Event fired more than once');
            eventSpy.alwaysCalledWithExactly(result).should.equal(true);
            done();
          });
        });
      });
    });
    it("should create a new relationship", function(done){
      var relationship = {
        from: rootUserId,
        to: secondId,
        type: 'FRIEND',
        data: {
          since: 'forever'
        }
      };
      var trans = new Transaction(db);
      trans.begin(function(err){
        should.not.exist(err);
        User.createRelationship(relationship, {transaction: trans}, function(err, rel){
          trans.commit(function(err2, response){
            should.not.exist(err);
            should.not.exist(err2);
            rel._id.should.be.a('number');
            relId = rel._id;
            rel.type.should.equal('FRIEND');
            rel.rel.since.should.equal('forever');
            done();
          });
        });
      });
    });
    it("should remove a relationship", function(done){
      var trans = new Transaction(db);
      trans.begin(function(err){
        should.not.exist(err);
        User.removeRelationship(relId, {transaction: trans}, function(err){
          trans.commit(function(err2, response){
            should.not.exist(err);
            should.not.exist(err2);
            done();
          });
        });
      });
    });
    it("should remove a node within a transaction", function(done){
      eventSpy = sinon.spy();
      User.schema.on('remove',eventSpy);
      var trans = new Transaction(db);
      // trans.on('remove',eventSpy);
      trans.begin(function(err){
        should.not.exist(err);
        User.remove(rootUserId, {transaction:trans, force: true}, function(err){
          trans.commit(function(err2, response){
            should.not.exist(err);
            should.not.exist(err2);
            response.length.should.equal(0);
            assert(eventSpy.called, 'Event did not fire.');
            assert(eventSpy.calledOnce, 'Event fired more than once');
            eventSpy.alwaysCalledWithExactly(rootUserId).should.equal(true);
            done();
          });
        });
      });
    });
    it("should close the transaction on err", function(done){
      var trans = new Transaction(db);
      trans.begin(function(err){
        should.not.exist(err);
        should.exist(trans._commit);
        User.create({first_name: 'Rory'}, {transaction: trans}, function(err){
          should.exist(err);
          should.not.exist(trans._commit);
          done();
        });
      });
    });
    it("should perform multiple operations in a single transaction", function(done){
      var trans = new Transaction(db);
      trans.begin(function(err){
        should.not.exist(err);
        User.create(userData, {transaction: trans}, function(err, user){
          should.not.exist(err);
          should.exist(user._id);
          var secondUser = {
            first_name: 'Cath',
            last_name: 'Fee',
            email: 'test@test.com'
          };
          User.create(secondUser, {transaction: trans}, function(err, user2){
            should.not.exist(err);
            should.exist(user2._id);
            User.createRelationship({from: user._id, to:user2._id, type: 'FRIEND'}, {transaction: trans}, function(err, rel){
              should.not.exist(err);
              rel.type.should.equal('FRIEND');
              trans.commit(function(err){
                should.not.exist(err);
                done();
              });
            });
          });
        });
      });
    });
    it("should include methods defined on the schema", function(done){
      var schema = new Schema({
        name: String
      }, {label: 'Blue'});
      schema.static('turnBlue', function(obj){
        obj.name = 'blue';
        return obj;
      });
      var m = Model.model('Blue', schema);
      var sample = {name: 'Green'};
      sample = m.turnBlue(sample);
      sample.name.should.equal('blue');
      done();
    });
  });
  describe("subschemas", function(){
    var Story;
    before(function(){
      var storySchema = new Schema({
        name: {type: 'String', required: true},
        content: String
      }, {label: 'Story'});
      var tagSchema = new Schema({
        tag: {type: String, required: true}
      }, {label: 'Tag'});
      var subTagSchema = new Schema({
        genre: String
      }, {label: 'SubTag'});
      var publisherSchema = new Schema({
        brnad: String
      }, {label: 'Publisher'});

      tagSchema.subSchema(subTagSchema, 'subtags', 'SUB');

      storySchema.subSchema(tagSchema, 'tags', 'TAGGED');
      storySchema.subSchema(publisherSchema, 'publishers', 'PUBLISHED');

      Story = Model.model('Story', storySchema);
    });
    // it("should create a node with a sub-node", function(done){
    //   var story1 = {
    //     name: 'Story',
    //     tags: {
    //       tag: 'fiction'
    //     }
    //   };
    //   Story.create(story1, function(err, story){
    //     should.not.exist(err);
    //     done();
    //   });
    // });
    // it("should create a node with an array of sub-nodes", function(done){
    //   var story1 = {
    //     name: 'Story',
    //     tags: [{
    //       tag: 'fiction'
    //     },{
    //       tag: 'autobiography'
    //     }]
    //   };
    //   Story.create(story1, function(err, story){
    //     should.not.exist(err);
    //     done();
    //   });
    // });
    // it("should create a node with multiple sub-nodes", function(done){
    //   var story1 = {
    //     name: 'Story',
    //     tags: {
    //       tag: 'fiction'
    //     },
    //     publishers: {
    //       brand: 'Macmillan'
    //     }
    //   };
    //   Story.create(story1, function(err, story){
    //     should.not.exist(err);
    //     done();
    //   });
    // });
    // it("should create a node with multiple level sub-nodes", function(done){
    //   var story1 = {
    //     name: 'Story',
    //     tags: {
    //       tag: 'fiction',
    //       subtags: {
    //         genre: 'horror'
    //       }
    //     }
    //   };
    //   Story.create(story1, function(err, story){
    //     should.not.exist(err);
    //     done();
    //   });
    // });
  });
});