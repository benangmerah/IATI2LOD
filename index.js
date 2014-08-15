var fs = require('fs');

var et = require('elementtree');
var rdf = require('rdf');

var AttributeHelper = require('./lib/AttributeHelper');
var IatiConverter = require('./lib/IatiConverter');

var IATI_NS = 'http://purl.org/collections/iati/';

exports.convertIatiString = function convertIatiString(iatiString, graph) {
  return exports.convertElementTree(et.parse(iatiString), graph);
};

exports.convertElementTree = function convertElementTree(tree, graph) {
  var root = tree.getroot();
  var version = AttributeHelper.attributeKey(root, 'version');
  var linkedDataDefault = AttributeHelper.attributeKey(root, 'linked-data-default');

  if (!graph) {
    graph = new rdf.Graph();
  }

  tree.findall('iati-activity').forEach(function(xml) {
    var converter = new IatiConverter.ConvertActivity(xml, version, linkedDataDefault);
    converter.convert(IATI_NS, graph);
  });

  return graph;
};