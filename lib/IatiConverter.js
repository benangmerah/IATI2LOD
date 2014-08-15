var _ = require('lodash');
var _s = require('underscore.string');

var AttributeHelper = require('./AttributeHelper');
var IatiElements = require('./IatiElements');

exports.ConvertActivity = ConvertActivity;

function ConvertActivity(xml, version, linkedDataDefault) {
  var self = this;

  self.xml = xml;

  self.id = self.getId();
  self.lastUpdated =
    AttributeHelper.attributeKey(self.xml, 'last-updated-datetime');

  self.version = self.determineVersion(version);
  self.linkedDataUri = self.determineLinkedDataUri(linkedDataDefault);

  self.hierarcy = AttributeHelper.attributeKey(self.xml, 'hierarchy');

  self.failed = [];
}

ConvertActivity.prototype.determineVersion = function(version) {
  var self = this;

  var activityVersion = AttributeHelper.attributeKey(self.xml, 'version');

  if (activityVersion) {
    return activityVersion;
  }

  return version;
};

ConvertActivity.prototype.determineLinkedDataUri =
function(linkedDataDefault, id) {
  var self = this;

  var linkedDataUri =
    AttributeHelper.attributeKey(self.xml, 'linked-data-uri');

  if (linkedDataUri) {
    return linkedDataUri;
  }

  if (linkedDataDefault) {
    return linkedDataDefault + id;
  }

  return null;
};

ConvertActivity.prototype.getId = function() {
  var self = this;

  var id = AttributeHelper.attributeText(self.xml, 'iati-identifier');

  if (id) {
    return id[0].split(/\s+/)[0];
  }

  return null;
};

ConvertActivity.prototype.getDefaultType = function(type) {
  var self = this;

  var defaultType = self.xml.find(type);
  
  if (!defaultType) {
    return null;
  }
  
  return AttributeHelper.attributeKey(defaultType, 'code');
};

ConvertActivity.prototype.getActivityDefaults = function() {
  var self = this;

  var defaults = {
    id: self.id,
    language:
      AttributeHelper
        .attributeKey(self.xml, '{http://www.w3.org/XML/1998/namespace}lang'),
    currency: AttributeHelper.attributeKey(self.xml, 'default-currency'),
    flowType: AttributeHelper.attributeKey(self.xml, 'default-flow-type'),
    aidType: AttributeHelper.attributeKey(self.xml, 'default-aid-type'),
    tiedStatus: AttributeHelper.attributeKey(self.xml, 'default-tied-status'),
    hierarchy: self.hierarchy,
    linkedDataUri: self.linkedDataUri
  };

  return defaults;
};

ConvertActivity.prototype.convert = function(namespace) {
  var self = this;

  if (!self.id) {
    return null;
  }

  var defaults = self.getActivityDefaults();
  defaults.namespace = namespace || '';

  var converter = new IatiElements.ActivityElements(defaults);

  self.xml.getchildren().forEach(function(attribute) {
    try {
      var funcname;
      if (_.contains(attribute.tag, ':')) {
        funcname =
          _s.camelize(attribute.tag.split(':')[1].replace(/default-/g, ''));
      }
      else if (_.contains(attribute.tag, '}')) {
        funcname =
          _s.camelize(attribute.tag.split('}')[1].replace(/default-/g, ''));
      }
      else {
        funcname = _s.camelize(attribute.tag.replace(/default-/g, ''));
      }

      converter[funcname](attribute);
    }
    catch (e) {
      // console.log(e.stack);
      try {
        converter.convertUnknown(attribute);
      }
      catch (e) {
        console.log('Could not convert ' + funcname + ' in file ' + self.id);
      }
    }
  });

  return converter.getResult();
};