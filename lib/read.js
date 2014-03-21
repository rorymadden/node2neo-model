'use strict';

var Node2NeoError = require('node2neo-schema').error;

/**
 * Generic find for your model
 * Conditions and callback are mandatory but fields and options are not
 *
 * Examples:
 * User.find({first:'Rory'}, function(err, nodes){})
 *
 * Options can include: limit, skip, using (to specify an index) or orderBy
 * limit: options = {limit: 10}
 * skip: options = {skip: 7}
 * using: options = {using: ['first, last']}  // can be a single value string or an array
 * orderBy: options = {orderBy: [{field: 'first', desc:true, nulls:true}]}
 * orderBy must be an array of objects - even if there is only one onject
 * each object in orderBy must contain a field element, desc and nulls are optional and default to false
 * User.find({first:'Rory'}, '', {limit: 5, skip:3, orderBy: [{first: 'last', desc:true, nulls: true}]}, function(){})
 *
 *
 * @param  {Object}   conditions  Object of fields and value
 * @param  {Object}   options     Object of options
 * @param  {Function} callback
 * @return {Node or Array}        If you specify a limit of 1 a single node is returned, otherwise an array of nodes
 */
module.exports.find = function(conditions, options, callback){
  var self = this;

  if ('function' == typeof conditions) {
    callback = conditions;
    return callback(new Node2NeoError('Invalid find. You must provide some conditions in your query'));
  } else if ('function' === typeof options) {
    callback = options;
    options = {};
  }

  // build query
  var query = 'MATCH (n:' + this.label + ')';
  var params = {};
  // if there are conditions add in the where clauses
  if(conditions){
    // if we are querying for an id we have to start our search differently
    if(conditions.hasOwnProperty('_id')){
      // query = 'START n='+this.objectType+'('+conditions['_id']+')';
      query = 'START n=node('+ conditions._id + ')';
      // remove the condition so it doesn't get checked again
      conditions = null;
    }
    // loop through all conditions and add a WHERE clause
    var firstWhere = true;
    for(var key in conditions){
      if(firstWhere) {
        query += ' WHERE n.' + key + ' = {' + key + '}';
        firstWhere = false;
      }
      else query += ' AND n.' + key + ' = {' + key + '}';

      // set the
      params[key] = self.schema._types[key] === 'number' ? parseInt(conditions[key], 10) : conditions[key];
    }
  }

  query += ' RETURN id(n), n';

  for(var option in options){
    // many options can be array of values orderBy, using
    switch(option) {
    case 'limit':
      // expected format options = { limit: 1 }
      query += ' LIMIT ' + options[option];
      break;
    case 'orderBy':
      //expected format options = {orderBy: [{ field: 'name', nulls: true}, {field: 'gender', desc: true}] }
      // nulls and desc are optional
      var lenO = options[option].length;
      for(var k=0; k<lenO; k++){
        if(options[option][k].field){
          query += ' ORDER BY n.' + options[option][k].field;
          // if(options[option][k].nulls) query += '?';
          if(options[option][k].desc) query += ' DESC';
          query += ', ';
        }
      }
      // clean up comma at end
      if(query.substr(-2,2) === ', ') query = query.substr(0, query.length - 2);
      break;
    case 'skip':
      // expected format options = { skip: 1 }
      query += ' SKIP ' + options[option];
      break;
    case 'using':
      //expected format options = {using: ['name', 'gender'] }
      if(typeof options[option] === 'array'){
        var lenO = options[option].length;
        for(var l=0; l<lenO; l++){
          query += ' USING INDEX n:'+ this.modelName + '(' + options[option][l] + ')';
        }
      }
      else query += ' USING INDEX n:'+ this.modelName + '(' + options[option] + ')';
      break;
    }
  }

  // convert the statement into the correct format
  var statement = {
    statement : query,
    parameters: params
  };

  // self.db.beginTransaction({statements: [statement]}, {commit:true}, function(err, results){
  //   if(err) return callback(err);
  //   else {
  //     if(results.errors.length > 0){
  //       return callback(results.errors);
  //     }
  //     else {
  //       var result = self.parseResults(results, options);
  //       return callback(null, result);
  //       // return callback(null, results);
  //     }
  //   }
  // });

  self.db.beginTransactionStream({statements: [statement]}, {commit:true})
    .on('error', function (err) { return callback (err); })
    .on('data', function (data) {
      return callback(null, self.parseResults(data, options));
    });
};

/**
 * Returns a single node which matches the conditions.
 * If multiple nodes match the first node will be returned
 * Conditions and callback are mandatory but options are not
 *
 * Examples:
 * User.findOne({first:'Rory'}, function(err, nodes){})
 *
 * Options can include: skip, using (to specify an index) or orderBy
 * skip: options = {skip: 7}
 * using: options = {using: ['first, last']}  // can be a single value string or an array
 * orderBy: options = {orderBy: [{field: 'first', desc:true, nulls:true}]}
 * orderBy must be an array of objects - even if there is only one onject
 * each object in orderBy must contain a field element, desc and nulls are optional and default to false
 * User.findOne({first:'Rory'}, {skip:3, orderBy: [{first: 'last', desc:true, nulls: true}]}, function(){})
 *
 *
 * @param  {Object}   conditions  Object of fields and value
 * @param  {Object}   options     Object of options
 * @param  {Function} callback
 * @return {Node/Relationship}    Node/Relationship
 */
 module.exports.findOne = function(conditions, options, callback){
  if ('function' === typeof options) {
    callback = options;
    options = {};
  } else if ('function' === typeof conditions) {
    callback = conditions;
    return callback(new Node2NeoError('Invalid findOne. You must provide some conditions in your query.'));
  }


  // only want to return one item
  options.limit = 1;
  var self = this;

  // pass to find
  // return this.find(conditions, options, function(err, results){
  //   if(err) return callback(err);
  //   else {
  //     if(results.errors.length > 0){
  //       return callback(results.errors);
  //     }
  //     else {
  //       var result = self.parseResults(results, options);

  //       return callback(null, result);
  //     }
  //   }
  // });
  return this.find(conditions, options, callback);
};

/**
 * Returns a single node which matches the id.
 * If multiple nodes match the first node will be returned
 * Id and callback are mandatory but options are not
 *
 * Examples:
 * User.findById(20189, function(err, nodes){})
 *
 * Options:
 * fields: string of space delimited fields to be returned
 *
 * User.findById(20189, {fields: 'firstname lastname'}, function(){})
 *
 *
 * @param  {Number}   id          Id requested
 * @param  {Object}   options     Object of options
 * @param  {Function} callback
 * @return {Object}               Id and node
 */
 module.exports.findById = function(id, options, callback) {
  if(typeof id ==='function'){
    callback = id;
    return callback(new Node2NeoError('Invalid findById: You need to include an id'));
  }
  if(typeof options === 'function'){
    callback = options;
    options = {};
  }

  // only want to return one item
  options.limit = 1;

  // var self = this;
  //
  // return this.findOne({ _id: id }, options, function(err, results){
  //   if(err) return callback(err);
  //   else {
  //     if(results.errors.length > 0){
  //       return callback(results.errors);
  //     }
  //     else {
  //       var result = self.parseResults(results, options);

  //       return callback(null, result);
  //     }
  //   }
  // });
  return this.find({ _id: parseInt(id,10) }, options, callback);
};


/**
 * Find a node by id and perform an update
 * @param  {number}   id       The id of the node to be returned
 * @param  {Object}   updates  The updates to be performed on the node
 * @param  {Object}   options  Optional. Transaction
 * @param  {Function} callback
 * @return {Object}            Id and node
 */
module.exports.findByIdAndUpdate = function(id, updates, options, callback){
  if ('function' === typeof options) {
    callback = options;
    options = {};
  } else if ('function' === typeof updates) {
    callback = conditions;
    return callback(new Node2NeoError('Invalid Update. You must provide some updates.'));
  }

  var self = this;
  this.findById(id, function(err, node){
    if(err) return callback(err);
    self.update(node, updates, options, function(err, result){
      return callback(err, result);
    });
  });
};



/**
 * Find a node by conditions and perform an update
 * @param  {number}   id       The id of the node to be returned
 * @param  {Object}   updates  The updates to be performed on the node
 * @param  {Object}   options  Optional. Skip, Limit, OrderBy, Transaction
 * @param  {Function} callback
 * @return {Object}            Id and node
 */

module.exports.findOneAndUpdate = function(conditions, updates, options, callback){
  if ('function' === typeof options) {
    callback = options;
    options = {};
  } else if ('function' === typeof updates) {
    callback = conditions;
    return callback(new Node2NeoError('Invalid Update. You must provide some updates.'));
  }

  var self = this;
  this.findOne(conditions, options, function(err, node){
    if(err) return callback(err);
    self.update(node, updates, options, function(err, result){
      return callback(err, result);
    });
  });
};

/**
 * Get relationships from a node
 *
 * conditions contains:
 *   types: single relationship type or array of types to be returned
 *   direction: 'to' or 'from'. Leave blank for both
 *   label: the single label to return
 *   nodeConditions: key:value query conditions to match data on the related nodes
 *   relConditions: key:value query conditions to match data on the relationship
 *
 *
 * @param  {Number} id         The id of the node whose relationships you are searching
 * @param  {Object} conditions Object containing query options for matching the relationships
 * @param  {Object} options    Limit, orderBy, skip and Using options. Optional.
 * @param  {Function} callback
 * @return {Array}             {rels: Array of relationships, nodes: Array of nodes}.
 * @api    public
 */
module.exports.getRelationships = function(id, conditions, options, callback){
  if(typeof options === 'function'){
    callback = options;
    options = {};
  }
  if(typeof conditions === 'function'){
    callback = conditions;
    conditions = {};
  }
  if(typeof id === 'function'){
    callback = id;
    return callback(new Node2NeoError('Invalid getRelationships request. You must provide the id of the node to request its relationships.'));
  }


  // Assume no types
  var types = '';
  if(conditions.types){
    if (conditions.types instanceof Array) {
      conditions.types.forEach(function(element){
        types += ':' + element + '| ';
      });
      // clear the last |
      types = types.substr(0, types.length-2);
    }
    else{
      types = ':' + conditions.types;
    }
  }

  var params = {
    id: parseInt(id, 10)
  };

  var query = 'START n=node({id}) MATCH (n)';
  if(conditions.direction && conditions.direction === 'to') query += '<';
  query += '-[r' + types + ']-';
  if(conditions.direction && conditions.direction === 'from') query += '>';

  if(conditions.label) query += '(o:' + conditions.label +')';
  else query += '(o)';

  var firstWhere = true;
  if(conditions.nodeConditions){
    // loop through all conditions and add a WHERE clause
    for(var key in conditions.nodeConditions){
      if(firstWhere) {
        query += ' WHERE o.' + key + ' = {' + key + '}';
        firstWhere = false;
      }
      else query += ' AND o.' + key + ' = {' + key + '}';
      params[key] = conditions.nodeConditions[key];
    }
  }
  if(conditions.relConditions){
    // loop through all conditions and add a WHERE clause
    for(var key in conditions.relConditions){
      if(firstWhere) {
        query += ' WHERE r.' + key + ' = {' + relKey + '}';
        firstWhere = false;
      }
      else query += ' AND r.' + key + ' = {' + relKey + '}';
      params[relKey] = conditions.relConditions[key];
    }
  }
  query += ' RETURN id(r), id(startnode(r)), r, type(r), id(o), o, labels(o)';

  //if there are options add in the options
  if(options){
    for(var option in options){
      // many options can be array of values orderBy, using
      switch(option) {
      case 'limit':
        // expected format options = { limit: 1 }
        query += ' LIMIT ' + options[option];
        break;
      case 'orderBy':
        //expected format options = {orderBy: [{ field: 'name', nulls: true}, {field: 'gender', desc: true}] }
        // nulls and desc are optional
        for(var k=0, lenO = options[option].length; k < lenO; k++){
          if(options[option][k].field){
            query += ' ORDER BY r.' + options[option][k].field;
            // if(options[option][k].nulls) query += '?';
            if(options[option][k].desc) query += ' DESC';
            query += ', ';
          }
        }
        // clean up comma at end
        if(query.substr(-2,2) === ', ') query = query.substr(0, query.length - 2);
        break;
      case 'skip':
        // expected format options = { skip: 1 }
        query += ' SKIP ' + options[option];
        break;
      case 'using':
        //expected format options = {using: ['name', 'gender'] }
        if(typeof options[option] === 'array'){
          for(var l=0, lenO = options[option].length; l<lenO; l++){
            query += ' USING INDEX r:'+ this.modelName + '(' + options[option][l] + ')';
          }
        }
        else query += ' USING INDEX r:'+ this.modelName + '(' + options[option] + ')';
        break;
      }
    }
  }

  var statement = {
    statement: query,
    parameters: params
  };

  var self = this;

  this.db.beginTransaction({statements:[statement]}, {commit:true}, function(err, results){
    if(err) return callback(err);
    else {
      if(results.errors.length > 0){
        return callback(results.errors);
      }
      else {
        return callback(null, parseRelationships(id, results));
      }
    }
  });
};

var parseRelationships = function(id, results){
  var result = {
    nodes: [],
    rels: []
  };

  results.results[0].data.forEach(function(element, index){
    var relId = results.results[0].data[index].row[0];
    var relStart = results.results[0].data[index].row[1];
    var rel = results.results[0].data[index].row[2];
    var type = results.results[0].data[index].row[3];
    var otherId = results.results[0].data[index].row[4];
    var otherNode = results.results[0].data[index].row[5];
    otherNode._nodeType = results.results[0].data[index].row[6][0];

    var direction = relStart === id ? 'from': 'to';

    otherNode._id = otherId;

    result.rels.push({
      _id: relId,
      type: type,
      direction: direction,
      data: rel
    });
    result.nodes.push(otherNode);
  });
  return result;
};
