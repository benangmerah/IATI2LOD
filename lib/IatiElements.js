var crypto = require('crypto');

var _ = require('lodash');
var _s = require('underscore.string');
var rdf = require('rdf');

var AttributeHelper = require('./AttributeHelper');

var RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
var RDFS_NS = 'http://www.w3.org/2000/01/rdf-schema#';
var OWL_NS = 'http://www.w3.org/2002/07/owl#';
var XSD_NS = 'http://www.w3.org/2001/XMLSchema#';

// Export declarations
exports.ActivityElements = ActivityElements;

// Convenience functions

function triple(s, p, o) {
  if (typeof s === 'string') {
    if (s.substring(0, 2) === '_:') {
      s = new rdf.BlankNode(s);
    }
    else {
      s = new rdf.NamedNode(s);
    }
  }

  if (typeof p === 'string') {
    p = new rdf.NamedNode(p);
  }

  if (typeof o === 'string') {
    if (o.substring(0, 2) === '_:') {
      o = new rdf.BlankNode(o);
    }
    else {
      o = new rdf.NamedNode(o);
    }
  }

  return new rdf.Triple(s, p, o);
}

function literal(o) {
  return new rdf.Literal(o);
}

// class ActivityElements

function ActivityElements(defaults, graph) {
  var self = this;

  self.id = defaults.id.replace(/ /g, '%20');
  self.defaultLanguage = defaults.language;
  self.defaultCurrency = defaults.currency;
  self.defaultFinanceType = defaults.financeType;
  self.defaultFlowType = defaults.flowType;
  self.defaultAidType = defaults.aidType;
  self.defaultTiedStatus = defaults.tiedStatus;
  self.hierarchy = defaults.hierarchy;
  self.linkedDataUri = defaults.linkedDataUri;
  self.iati = defaults.namespace;
  self.iatiCustom = defaults.namespace + 'custom/';

  if (!graph) {
    graph = new rdf.Graph();
  }
  self.graph = graph;

  self.graph.add(triple(
    self.iati + 'activity/' + self.id,
    RDF_NS + 'type',
    self.iati + 'activity'
  ));

  if (self.hierarchy) {
    self.graph.add(triple(
      self.iati + 'activity/' + self.id,
      self.iati + 'activity-hierarchy',
      literal(self.hierarchy)
    ));
  }

  if (self.linkedDataUri) {
    self.linkedDataUri = self.linkedDataUri.replace(/ /g, '%20');
    self.graph.add(triple(
      self.iati + 'activity/' + self.id,
      OWL_NS + 'sameAs',
      literal(self.linkedDataUri)
    ));
  }
}

ActivityElements.prototype.getResult = function() {
  var self = this;

  return self.graph;
};

ActivityElements.prototype.processUnknownTag = function(tag) {
  var self = this;

  tag = tag.replace(/\{|\}/g, '');

  if (_.contains(tag, ':')) {
    if (tag.substring(0, 4) === 'http') {
      var lastPos = tag.lastIndexOf('/');
      var tagName = tag.substring(lastPos).replace(/ /g, '%20');
      return [tag.replace(/ /g, '-'), tagName];
    }

    tag = tag.split(':')[1];
  }

  if (tag.substring(0, 9) === 'activity-') {
    return [self.iati + tag.replace(/ /g, '-'), tag.replace(/ /g, '%20')];
  }

  return [self.iati + 'activity-' + tag.replace(/ /g, '-'),
          'activity-' + tag.replace(/ /g, '-')];
};

// TODO remove the 'return;' line
ActivityElements.prototype.convertUnknown = function(xml) {
  var self = this;
  var key, keyText, lastPos;

  if (xml.tag.indexOf('ignore') !== -1) {
    return null;
  }

  var namespaceAndName = self.processUnknownTag(xml.tag);
  var namespace = namespaceAndName[0];
  var name = namespaceAndName[1];

  var childrenElements = xml.findall('./');

  if (childrenElements.length === 0) {
    // No children
    if (xml.text) {
      self.graph.add(triple(
        self.iati + 'activity/' + self.id,
        namespace,
        literal(xml.text)
      ));
    }

    for (key in xml.attrib) {
      keyText = xml.attrib[key];
      if (key.indexOf('}') !== -1) {
        key = key.substring(key.lastIndexOf('}'));
      }
      if (keyText) {
        self.graph.add(triple(
          self.iati + 'activity/' + self.id,
          namespace + '-' + key.replace(/ /g, '-')
        ));
      }
    }

    return;
  }

  // Has children

  self.graph.add(triple(
    self.iati + 'activity/' + self.id,
    namespace,
    self.iati + 'activity/' + self.id + '/' + name
  ));

  for (key in xml.attrib) {
    keyText = xml.attrib[key];
    if (_.contains(key, '}')) {
      lastPos = key.lastIndexOf('}');
      key = key.substring(lastPos);
    }

    if (keyText) {
      self.graph.add(triple(
        self.iati + 'activity/' + self.id + '/' + name,
        self.iatiCustom + key.replace(/ /g, '-'),
        literal(keyText)
      ));
    }
  }

  xml.getchildren().forEach(function(child) {
    var childrenElements = child.findall('./');

    var childNamespaceAndName = self.processUnknownTag(child.tag);
    var childNamespace = childNamespaceAndName[0];
    var childName = childNamespaceAndName[1];

    if (childrenElements.length === 0) {
      // No grandchildren

      if (child.text) {
        self.graph.add(triple(
          self.iati + 'activity/' + self.id + '/' + name,
          childNamespace,
          literal(child.text)
        ));
      }

      return;
    }

    // Has grandchildren
    self.graph.add(triple(
      self.iati + 'activity/' + self.id + '/' + name,
      namespace + '-' + childName,
      self.iati + 'activity/' + self.id + '/' + name + '/' + childName
    ));

    for (var key in child.attrib) {
      var keyText = child.attrib[key];

      if (_.contains(key, '}')) {
        var lastPos = key.lastIndexOf('}');
        key = key.substring(lastPos);
      }

      if (keyText) {
        self.graph.add(triple(
          self.iati + 'activity/' + self.id + '/' + name + '/' + childName,
          self.iatiCustom + key.replace(/ /g, '-'),
          literal(keyText)
        ));
      }
    }

    child.getchildren().forEach(function(grandchild) {
      var grandchildrenElements = grandchild.findall('./');

      var grandchildNsN = self.processUnknownTag(grandchild.tag);
      var grandchildNamespace = grandchildNsN[0];
      var grandchildName = grandchildNsN[1];

      if (grandchildrenElements.length === 0) {
        // No great-grandchildren
        
        if (grandchild.text) {
          self.graph.add(triple(
            self.iati + 'activity/' + self.id + '/' + name + '/' + childName,
            grandchildNamespace,
            literal(grandchild.text)
          ));
        }

        for (var key in grandchild.attrib) {
          var keyText = grandchild.attrib[key];
          if (_.contains(key, '}')) {
            var lastPos = key.lastIndexOf('}');
            key = key.substring(lastPos);
          }

          if (keyText) {
            self.graph.add(triple(
              self.iati + 'activity/' + self.id + '/' +
                name + '/' + childName,
              grandchildNamespace + '-' + key.replace(/ /g, '-'),
              literal(keyText)
            ));
          }
        }

        return;
      }

      console.log('Three levels for a non-IATI element (' +
                  name +
                  ') is not supported...');
    });
  });
};

ActivityElements.prototype.reportingOrg = function(xml) {
  var self = this;

  // Keys
  var ref = AttributeHelper.attributeKey(xml, 'ref');
  var type = AttributeHelper.attributeKey(xml, 'type');

  // Text
  var name = AttributeHelper.attributeLanguage(xml, self.defaultLanguage);

  if (ref) {
    ref = ref.replace(/ /g, '%20');

    self.graph.add(triple(
      self.iati + 'activity/' + self.id,
      self.iati + 'activity-reporting-org',
      self.iati + 'activity/' + self.id + '/reporting-org/' + ref
    ));
    
    self.graph.add(triple(
      self.iati + 'activity/' + self.id + '/reporting-org/' + ref,
      RDF_NS + 'type',
      self.iati + 'organisation'
    ));
    
    self.graph.add(triple(
      self.iati + 'activity/' + self.id + '/reporting-org/' + ref,
      self.iati + 'organisation-code',
      self.iati + 'codelist/OrganisationIdentifier/' + ref
    ));

    if (name) {
      self.graph.add(triple(
        self.iati + 'activity/' + self.id + '/reporting-org/' + ref,
        RDFS_NS + 'label',
        name
      ));
    }

    if (type) {
      type = type.replace(/ /g, '%20');
      self.graph.add(triple(
        self.iati + 'activity/' + self.id + '/reporting-org/' + ref,
        self.iati + 'organisation-type',
        self.iati + 'codelist/OrganisationType/' + type
      ));
    }

    return;
  }

  if (name) {
    // Create hash
    // Required: name
    
    var hash = crypto.createHash('md5');
    hash.update(name);

    var hashName = hash.digest('hex');

    self.graph.add(triple(
      self.iati + 'activity/' + self.id,
      self.iati + 'activity/reporting-org',
      self.iati + 'activity/' + self.id + '/reporting-org/' + hashName
    ));

    self.graph.add(triple(
      self.iati + 'activity/' + self.id + '/reporting-org/' + hashName,
      RDF_NS + 'type',
      self.iati + 'organisation'
    ));

    self.graph.add(triple(
      self.iati + 'activity/' + self.id + '/reporting-org/' + hashName,
      RDFS_NS + 'label',
      name
    ));

    if (type) {
      type = type.replace(/ /g, '%20');
      self.graph.add(triple(
        self.iati + 'activity/' + self.id + '/reporting-org/' + hashName,
        self.iati + 'organisation-type',
        self.iati + 'codelist/OrganisationType/' + type
      ));
    }

    return;
  }
};

ActivityElements.prototype.iatiIdentifier = function(xml) {
  var self = this;

  // Text
  var id = xml.text;

  if (id) {
    id = id.replace(/\s+/g, ' ');

    self.graph.add(triple(
      self.iati + 'activity/' + self.id,
      self.iati + 'activity-id',
      literal(id)
    ));
  }
};

ActivityElements.prototype.otherIdentifier = function(xml) {
  var self = this;

  var ownerRef = AttributeHelper.attributeKey(xml, 'owner-ref');
  var ownerName = AttributeHelper.attributeKey(xml, 'owner-name');

  var name = xml.text;

  if (name) {
    var hash = crypto.createHash('md5');
    hash.update(name);

    var hashName = hash.digest('hex');

    name = name.replace(/\s+/g, ' ');

    self.graph.add(triple(
      self.iati + 'activity/' + self.id,
      self.iati + 'activity-other-identifier',
      self.iati + 'activity/' + self.id + '/other-identifier/' + hashName
    ));

    self.graph.add(triple(
      self.iati + 'activity/' + self.id + '/other-identifier/' + hashName,
      RDFS_NS + 'label',
      literal(name)
    ));

    if (ownerRef) {
      ownerRef = ownerRef.replace(/ /g, '%20');

      self.graph.add(triple(
        self.iati + 'activity/' + self.id + '/other-identifier/' + hashName,
        self.iati + 'other-identifier-owner-ref',
        self.iati + 'codelist/OrganisationIdentifier/' + ownerRef
      ));
    }

    if (ownerName) {
      self.graph.add(triple(
        self.iati + 'activity/' + self.id + '/other-identifier/' + hashName,
        self.iati + 'other-identifier-owner-ref',
        literal(ownerName)
      ));
    }
  }
};

// Different from Brandt: URIs are not escaped
ActivityElements.prototype.activityWebsite = function(xml) {
  var self = this;

  // Text
  var website = xml.text;

  if (website) {
    self.graph.add(triple(
      self.iati + 'activity/' + self.id,
      self.iati + 'activity-website',
      website
    ));
  }
};

ActivityElements.prototype.title = function(xml) {
  var self = this;

  // Text
  var title = AttributeHelper.attributeLanguage(xml, self.defaultLanguage);

  if (title) {
    self.graph.add(triple(
      self.iati + 'activity/' + self.id,
      RDFS_NS + 'label',
      title
    ));
  }
};

ActivityElements.prototype.description = function(xml) {
  var self = this;

  // Keys
  var type = AttributeHelper.attributeKey(xml, 'type');

  // Text
  var description =
    AttributeHelper.attributeLanguage(xml, self.defaultLanguage);

  if (description) {
    var hash = crypto.createHash('md5');
    hash.update(description);

    var hashDescription = hash.digest('hex');

    self.graph.add(triple(
      self.iati + 'activity/' + self.id,
      self.iati + 'activity-description',
      self.iati + 'activity/' + self.id + '/description/' + hashDescription
    ));

    self.graph.add(triple(
      self.iati + 'activity/' + self.id + '/description/' + hashDescription,
      RDF_NS + 'type',
      self.iati + 'description'
    ));

    self.graph.add(triple(
      self.iati + 'activity/' + self.id + '/description/' + hashDescription,
      self.iati + 'description-text',
      description
    ));

    if (type) {
      type = type.replace(/ /g, '%20');

      self.graph.add(triple(
        self.iati + 'activity/' + self.id + '/description/' + hashDescription,
        self.iati + 'description-type',
        self.iati + 'codelist/DescriptionType/' + type
      ));
    }
  }
};

ActivityElements.prototype.activityStatus = function(xml) {
  var self = this;

  // Text
  var code = AttributeHelper.attributeKey(xml, 'code');

  if (code) {
    code = code.replace(/ /g, '%20');
    self.graph.add(triple(
      self.iati + 'activity/' + self.id,
      self.iati + 'activity-status',
      self.iati + 'codelist/ActivityStatus/' + code
    ));
  }
};

ActivityElements.prototype.activityDate = function(xml) {
  var self = this;

  // Keys
  var type = AttributeHelper.attributeKey(xml, 'type');
  var isoDate = AttributeHelper.attributeKey(xml, 'isoDate');

  // Text
  var name = AttributeHelper.attributeLanguage(xml, self.defaultLanguage);

  if (type) {
    if (isoDate) {
      self.graph.add(triple(
        self.iati + 'activity/' + self.id,
        self.iati + type + '-date',
        literal(isoDate)
      ));
    }
    if (name) {
      self.graph.add(triple(
        self.iati + 'activity/' + self.id,
        self.iati + type + '-text',
        name
      ));
    }
  }
};

ActivityElements.prototype.contactInfo = function(xml) {
  var self = this;

  // Create hash
  // Required: one of organisation, person-name,
  //  telephone, email, mailing-address
  var hash = crypto.createHash('md5');
  var hashCreated = false;

  var organisationText = AttributeHelper.attributeText(xml, 'organisation');
  if (organisationText) {
    hash.update(organisationText[0]);
    hashCreated = true;
  }
  var personNameText = AttributeHelper.attributeText(xml, 'person-name');
  if (personNameText) {
    hash.update(personNameText[0]);
    hashCreated = true;
  }
  var telephoneText = AttributeHelper.attributeText(xml, 'telephone');
  if (telephoneText) {
    hash.update(telephoneText[0]);
    hashCreated = true;
  }
  var emailText = AttributeHelper.attributeText(xml, 'email');
  if (emailText) {
    hash.update(emailText[0]);
    hashCreated = true;
  }
  var mailingAddressText =
    AttributeHelper.attributeText(xml, 'mailing-address');
  if (mailingAddressText) {
    hash.update(mailingAddressText[0]);
    hashCreated = true;
  }

  if (!hashCreated) {
    return;
  }

  var hashContactInfo = hash.digest('hex');
  self.graph.add(triple(
    self.iati + 'activity/' + self.id,
    self.iati + 'activity-contact-info',
    self.iati + 'activity/' + self.id + '/contact-info/' + hashContactInfo
  ));
  self.graph.add(triple(
    self.iati + 'activity/' + self.id + '/contact-info/' + hashContactInfo,
    RDF_NS + 'type',
    self.iati + 'contact-info'
  ));

  xml.getchildren().forEach(function(element) {
    var info = element.text;

    if (!info) {
      return;
    }

    info = info.replace(/\s+/g, ' ');

    var property = 'contact-info-' + _s.dasherize(element.tag);

    self.graph.add(triple(
      self.iati + 'activity/' + self.id + '/contact-info/' + hashContactInfo,
      self.iati + property,
      literal(info)
    ));
  });
};

ActivityElements.prototype.participatingOrg = function(xml) {
  var self = this;

  // Keys
  var ref = AttributeHelper.attributeKey(xml, 'ref');
  var type = AttributeHelper.attributeKey(xml, 'type');
  var role = AttributeHelper.attributeKey(xml, 'role');

  // Text
  var name = AttributeHelper.attributeLanguage(xml, self.defaultLanguage);

  if (ref) {
    ref = ref.replace(/ /g, '%20');

    self.graph.add(triple(
      self.iati + 'activity/' + self.id,
      self.iati + 'activity-participating-org',
      self.iati + 'activity/' + self.id + '/participating-org/' + ref
    ));
    
    self.graph.add(triple(
      self.iati + 'activity/' + self.id + '/participating-org/' + ref,
      RDF_NS + 'type',
      self.iati + 'organisation'
    ));
    
    self.graph.add(triple(
      self.iati + 'activity/' + self.id + '/participating-org/' + ref,
      self.iati + 'organisation-code',
      self.iati + 'codelist/OrganisationIdentifier/' + ref
    ));

    if (name) {
      self.graph.add(triple(
        self.iati + 'activity/' + self.id + '/participating-org/' + ref,
        RDFS_NS + 'label',
        name
      ));
    }

    if (type) {
      type = type.replace(/ /g, '%20');
      self.graph.add(triple(
        self.iati + 'activity/' + self.id + '/participating-org/' + ref,
        self.iati + 'organisation-type',
        self.iati + 'codelist/OrganisationType/' + type
      ));
    }

    if (role) {
      role = role.replace(/ /g, '%20');
      self.graph.add(triple(
        self.iati + 'activity/' + self.id + '/participating-org/' + ref,
        self.iati + 'organisation-role',
        self.iati + 'codelist/OrganisationRole/' + role
      ));
    }

    return;
  }

  if (name) {
    // Create hash
    // Required: name
    
    var hash = crypto.createHash('md5');
    hash.update(name);

    var hashName = hash.digest('hex');

    self.graph.add(triple(
      self.iati + 'activity/' + self.id,
      self.iati + 'activity/participating-org',
      self.iati + 'activity/' + self.id + '/participating-org/' + hashName
    ));

    self.graph.add(triple(
      self.iati + 'activity/' + self.id + '/participating-org/' + hashName,
      RDF_NS + 'type',
      self.iati + 'organisation'
    ));

    self.graph.add(triple(
      self.iati + 'activity/' + self.id + '/participating-org/' + hashName,
      RDFS_NS + 'label',
      name
    ));

    if (type) {
      type = type.replace(/ /g, '%20');
      self.graph.add(triple(
        self.iati + 'activity/' + self.id + '/participating-org/' + hashName,
        self.iati + 'organisation-type',
        self.iati + 'codelist/OrganisationType/' + type
      ));
    }

    if (role) {
      role = role.replace(/ /g, '%20');
      self.graph.add(triple(
        self.iati + 'activity/' + self.id + '/participating-org/' + hashName,
        self.iati + 'organisation-role',
        self.iati + 'codelist/OrganisationRole/' + role
      ));
    }

    return;
  }
};

ActivityElements.prototype.recipientCountry = function(xml) {
  var self = this;

  // Keys
  var code = AttributeHelper.attributeKey(xml, 'code');
  var percentage = AttributeHelper.attributeKey(xml, 'percentage');

  // Text
  var countryName =
    AttributeHelper.attributeLanguage(xml, self.defaultLanguage);

  if (code) {
    code = code.replace(/\s+/g, '%20');

    self.graph.add(triple(
      self.iati + 'activity/' + self.id,
      self.iati + 'activity-recipient-country',
      self.iati + 'activity/' + self.id + '/recipient-country/' + code
    ));

    self.graph.add(triple(
      self.iati + 'activity/' + self.id + '/recipient-country/' + code,
      RDF_NS + 'type',
      self.iati + 'country'
    ));

    self.graph.add(triple(
      self.iati + 'activity/' + self.id + '/recipient-country/' + code,
      self.iati + 'country-code',
      self.iati + 'codelist/Country/' + code
    ));

    if (countryName) {
      self.graph.add(triple(
        self.iati + 'activity/' + self.id + '/recipient-country/' + code,
        RDFS_NS + 'label',
        countryName
      ));
    }

    if (percentage) {
      self.graph.add(triple(
        self.iati + 'activity/' + self.id + '/recipient-country/' + code,
        self.iati + 'percentage',
        literal(percentage)
      ));
    }
  }
};

ActivityElements.prototype.recipientRegion = function(xml) {
  var self = this;

  // Keys
  var code = AttributeHelper.attributeKey(xml, 'code');
  var percentage = AttributeHelper.attributeKey(xml, 'percentage');
  
  // Text
  var regionName = AttributeHelper.attributeLanguage(xml, self.defaultLanguage);
  
  if (code) {
    code = code.replace(' ', '%20');
    
    self.graph.add(triple(
      self.iati['activity/' + self.id],
      self.iati['activity-recipient-region'],
      self.iati['activity/' + self.id + '/recipient-region/' + code]
    ));
    
    self.graph.add(triple(
      self.iati['activity/' + self.id + '/recipient-region/' + code],
      RDF_NS + 'type',
      self.iati.region
    ));
    
    self.graph.add(triple(
      self.iati['activity/' + self.id + '/recipient-region/' + code],
      self.iati['region-code'],
      self.iati['codelist/Region/' + code]
    ));
  
    if (regionName) {
      self.graph.add(triple(
        self.iati['activity/' + self.id + '/recipient-region/' + code],
        RDFS_NS + 'label',
        regionName
      ));
    }
      
    if (percentage) {
      self.graph.add(triple(
        self.iati['activity/' + self.id + '/recipient-region/' + code],
        self.iati.percentage,
        literal(percentage)
      ));
    }
  }
};

ActivityElements.prototype.location = function(xml) {
  var self = this;

  /*Converts the XML of the location element to a RDFLib self.graph.

  Parameters
  @xml: The XML of this element.*/

  // Keys
  var percentage = AttributeHelper.attributeKey(xml, 'percentage');

  // Elements
  var name = xml.find('name');
  var descriptions = xml.findall('description');
  var locationType = xml.find('location-type');
  var administrative = xml.find('administrative');
  var coordinates = xml.find('coordinates');
  var gazetteerEntry = xml.find('gazetteer-entry');

  var latitude, longitude;
  var administrativeCountry, administrativeAdm1, administrativeAdm2;

  // Create hash
  // Required: one of name, description,
  //  administrative (text / country / adm1 / adm2),
  //  coordinates (lat / long), gazetteer entry

  var hash = crypto.createHash('md5');
  var hashCreated = false;

  var nameText = AttributeHelper.attributeText(xml, 'name');
  if (nameText) {
    hash.update(nameText[0]);
    hashCreated = true;
  }
  var descriptionText = AttributeHelper.attributeText(xml, 'description');
  if (descriptionText) {
    hash.update(descriptionText[0]);
    hashCreated = true;
  }
  var administrativeText =
    AttributeHelper.attributeText(xml, 'administrative');
  if (administrativeText) {
    hash.update(administrativeText[0]);
    hashCreated = true;
  }
  var gazetteerEntryText =
    AttributeHelper.attributeText(xml, 'gazetteer-entry');
  if (gazetteerEntryText) {
    hash.update(gazetteerEntryText[0]);
    hashCreated = true;
  }
  if (administrative) {
    // Keys
    administrativeCountry =
      AttributeHelper.attributeKey(administrative, 'country');
    administrativeAdm1 =
      AttributeHelper.attributeKey(administrative, 'adm1');
    administrativeAdm2 =
      AttributeHelper.attributeKey(administrative, 'adm2');
    if (administrativeCountry) {
      hash.update(administrativeCountry);
      hashCreated = true;
    }
    if (administrativeAdm1) {
      hash.update(administrativeAdm1);
      hashCreated = true;
    }
    if (administrativeAdm2) {
      hash.update(administrativeAdm2);
      hashCreated = true;
    }
  }
  if (coordinates) {
    // Keys
    latitude = AttributeHelper.attributeKey(coordinates, 'latitude');
    longitude = AttributeHelper.attributeKey(coordinates, 'longitude');
    if (latitude) {
      hash.update(latitude);
      hashCreated = true;
    }
    if (longitude) {
      hash.update(longitude);
      hashCreated = true;
    }
  }

  if (hashCreated) {
    var hashLocation = hash.digest('hex');

    self.graph.add(triple(
      self.iati + 'activity/' + self.id,
      self.iati + 'activity-location',
      self.iati + 'activity/' + self.id + '/location/' + hashLocation
    ));

    self.graph.add(triple(
      self.iati + 'activity/' + self.id + '/location/' + hashLocation,
      RDF_NS + 'type',
      self.iati + 'location'
    ));

    if (name) {
      // Text
      nameText = AttributeHelper.attributeLanguage(name, self.defaultLanguage);

      if (nameText) {
        self.graph.add(triple(
          self.iati + 'activity/' + self.id + '/location/' + hashLocation,
          RDFS_NS + 'label',
          nameText
        ));
      }
    }

    if (descriptions.length !== 0) {
      descriptions.forEach(function(description) {
        // Keys
        var type = AttributeHelper.attributeKey(description, 'type');

        // Text
        var descriptionText =
          AttributeHelper.attributeLanguage(description, self.defaultLanguage);

        if (descriptionText) {
          // Create hash
          // Required: description

          var hashDescription = crypto.createHash('md5');

          var descriptionNolanguage = description.text;
          hashDescription.update(descriptionNolanguage);

          var hashLocationDescription = hashDescription.digest('hex');

          self.graph.add(triple(
            self.iati + 'activity/' + self.id + '/location/' + hashLocation,
            self.iati + 'location-description',
            self.iati + 'activity/' + self.id + '/location/' + hashLocation +
                        '/description/' + hashLocationDescription
          ));

          self.graph.add(triple(
            self.iati + 'activity/' + self.id + '/location/' + hashLocation +
                        '/description/' + hashLocationDescription,
            RDF_NS + 'type',
            self.iati + 'description'
          ));

          self.graph.add(triple(
            self.iati + 'activity/' + self.id + '/location/' + hashLocation +
                        '/description/' + hashLocationDescription,
            self.iati + 'description-text',
            descriptionText
          ));

          if (type) {
            type = type.replace(/ /g, '%20');

            self.graph.add(triple(
              self.iati + 'activity/' + self.id + '/location/' + hashLocation +
                          '/description/' + hashLocationDescription,
              self.iati + 'description-type',
              self.iati + 'codelist/DescriptionType/' + type
            ));
          }
        }
      });
    }

    if (locationType) {
      // Keys
      var locationTypeCode = AttributeHelper.attributeKey(locationType, 'code');

      if (locationTypeCode) {
        locationTypeCode = locationTypeCode.replace(/ /g, '%20');

        self.graph.add(triple(
          self.iati + 'activity/' + self.id + '/location/' + hashLocation,
          self.iati + 'location-type',
          self.iati + 'codelist/LocationType/' + locationTypeCode
        ));
      }
    }

    if (administrative) {
      // Keys
      administrativeCountry =
        AttributeHelper.attributeKey(administrative, 'country');
      administrativeAdm1 =
        AttributeHelper.attributeKey(administrative, 'adm1');
      administrativeAdm2 =
        AttributeHelper.attributeKey(administrative, 'adm2');

      // Text
      administrativeText =
        AttributeHelper
          .attributeLanguage(administrative, self.defaultLanguage);

      // Create hash
      // Required: one of administrative country / adm1 / adm2 / text
      var hashAdministrative = crypto.createHash('md5');
      var hashAdministrativeCreated = false;

      var administrativeHashText =
        AttributeHelper.attributeText(xml, 'administrative');
      if (administrativeHashText) {
        hashAdministrative.update(administrativeHashText[0]);
        hashAdministrativeCreated = true;
      }
      if (administrativeCountry) {
        hashAdministrative.update(administrativeCountry);
        hashAdministrativeCreated = true;
      }
      if (administrativeAdm1) {
        hashAdministrative.update(administrativeAdm1);
        hashAdministrativeCreated = true;
      }
      if (administrativeAdm2) {
        hashAdministrative.update(administrativeAdm2);
        hashAdministrativeCreated = true;
      }

      if (hashAdministrativeCreated) {
        var hashLocationAdministrative = hashAdministrative.digest('hex');

        self.graph.add(triple(
          self.iati + 'activity/' + self.id + '/location/' + hashLocation,
          self.iati + 'location-administrative',
          self.iati + 'activity/' + self.id + '/location/' + hashLocation +
                      '/administrative/' + hashLocationAdministrative
        ));

        if (administrativeCountry) {
          administrativeCountry = administrativeCountry.replace(/ /g, '%20');

          self.graph.add(triple(
            self.iati + 'activity/' + self.id + '/location/' + hashLocation +
                        '/administrative/' + hashLocationAdministrative,
            self.iati + 'administrative-country',
            self.iati + 'codelist/Country/' + administrativeCountry
          ));
        }

        if (administrativeAdm1) {
          self.graph.add(triple(
            self.iati + 'activity/' + self.id + '/location/' + hashLocation +
                        '/administrative/' + hashLocationAdministrative,
            self.iati + 'administrative-adm1',
            literal(administrativeAdm1)
          ));
        }

        if (administrativeAdm2) {
          self.graph.add(triple(
            self.iati + 'activity/' + self.id + '/location/' + hashLocation +
                        '/administrative/' + hashLocationAdministrative,
            self.iati + 'administrative-adm2',
            literal(administrativeAdm2)
          ));
        }

        if (administrativeText) {
          self.graph.add(triple(
            self.iati + 'activity/' + self.id + '/location/' + hashLocation +
                        '/administrative/' + hashLocationAdministrative,
            self.iati + 'administrative-country-text',
            administrativeText
          ));
        }
      }
    }

    if (coordinates) {
      // Keys
      latitude = AttributeHelper.attributeKey(coordinates, 'latitude');
      longitude = AttributeHelper.attributeKey(coordinates, 'longitude');
      var precision = AttributeHelper.attributeKey(coordinates, 'precision');

      if (latitude) {
        self.graph.add(triple(
          self.iati + 'activity/' + self.id + '/location/' + hashLocation,
          self.iati + 'latitude',
          literal(latitude)
        ));
      }

      if (longitude) {
        self.graph.add(triple(
          self.iati + 'activity/' + self.id + '/location/' + hashLocation,
          self.iati + 'longitude',
          literal(longitude)
        ));
      }

      if (precision) {
        precision = precision.replace(/ /g, '%20');

        self.graph.add(triple(
          self.iati + 'activity/' + self.id + '/location/' + hashLocation,
          self.iati + 'coordinates-precision',
          self.iati + 'codelist/GeographicalPrecision/' + precision
        ));
      }
    }

    if (gazetteerEntry) {
      // Keys
      var gazetteerRef =
        AttributeHelper.attributeKey(gazetteerEntry, 'gazetteer-ref');

      // Text
      gazetteerEntryText = gazetteerEntry.text;

      if (gazetteerRef && gazetteerEntryText) {
        gazetteerRef = gazetteerRef.replace(/ /g, '%20');

        gazetteerEntryText = gazetteerEntryText.replace(/\s+/g, ' ');

        self.graph.add(triple(
          self.iati + 'activity/' + self.id + '/location/' + hashLocation,
          self.iati + 'location-gazetteer-entry',
          self.iati + 'activity/' + self.id + '/location/' + hashLocation +
                      '/gazetteer-entry/' + gazetteerRef
        ));

        self.graph.add(triple(
          self.iati + 'activity/' + self.id + '/location/' + hashLocation +
                      '/gazetteer-entry/' + gazetteerRef,
          RDF_NS + 'type',
          self.iati + 'gazetteer-entry'
        ));

        self.graph.add(triple(
          self.iati + 'activity/' + self.id + '/location/' + hashLocation +
                      '/gazetteer-entry/' + gazetteerRef,
          self.iati + 'gazetteer-ref',
          self.iati + 'codelist/GazetteerAgency/' + gazetteerRef
        ));

        self.graph.add(triple(
          self.iati + 'activity/' + self.id + '/location/' + hashLocation +
                      '/gazetteer-entry/' + gazetteerRef,
          self.iati + 'gazetteer-entry',
          literal(gazetteerEntryText)
        ));

        if (gazetteerRef === 'GEO') {
          gazetteerEntryText = gazetteerEntryText.replace(/ /g, '%20');

          self.graph.add(triple(
            self.iati + 'activity/' + self.id + '/location/' + hashLocation,
            OWL_NS + 'sameAs',
            'http://sws.geonames.org/' + gazetteerEntryText
          ));
        }
      }
    }
  }
};

ActivityElements.prototype.___ = function(xml) {
  var self = this;
};

ActivityElements.prototype.sector = function(xml) {
  var self = this;

  /*Converts the XML of the sector element to a RDFLib self.graph.

  Parameters
  @xml: The XML of this element.*/

  // Keys
  var code = AttributeHelper.attributeKey(xml, 'code');
  var vocabulary = AttributeHelper.attributeKey(xml, 'vocabulary');
  var percentage = AttributeHelper.attributeKey(xml, 'percentage');

  // Text
  var name = AttributeHelper.attributeLanguage(xml, self.defaultLanguage);

  if (code && vocabulary) {
    code = code.replace(/ /g, '%20');
    vocabulary = vocabulary.replace(/ /g, '%20');

    self.graph.add(triple(
      self.iati + 'activity/' + self.id,
      self.iati + 'activity-sector',
      self.iati + 'activity/' + self.id + '/sector/' + vocabulary +
                  '/' + code
    ));

    self.graph.add(triple(
      self.iati + 'activity/' + self.id + '/sector/' + vocabulary +
                  '/' + code,
      RDF_NS + 'type',
      self.iati + 'sector'
    ));

    self.graph.add(triple(
      self.iati + 'activity/' + self.id + '/sector/' + vocabulary +
                  '/' + code,
      self.iati + 'sector-code',
      self.iati + 'codelist/Sector/' + code
    ));

    self.graph.add(triple(
      self.iati + 'activity/' + self.id + '/sector/' + vocabulary +
                  '/' + code,
      self.iati + 'sector-vocabulary',
      self.iati + 'codelist/Vocabulary/' + vocabulary
    ));

    if (percentage) {
      self.graph.add(triple(
        self.iati + 'activity/' + self.id + '/sector/' + vocabulary +
                    '/' + code,
        self.iati + 'percentage',
        literal(percentage)
      ));
    }

    if (name) {
      self.graph.add(triple(
        self.iati + 'activity/' + self.id + '/sector/' + vocabulary +
                    '/' + code,
        RDFS_NS + 'label',
        name
      ));
    }
  }
};

ActivityElements.prototype.policyMarker = function (xml) {
  var self = this;

  /*Converts the XML of the policy-marker element to a RDFLib self.graph.

  Parameters
  @xml: The XML of this element.*/

  // Keys
  var code = AttributeHelper.attributeKey(xml, 'code');
  var vocabulary = AttributeHelper.attributeKey(xml, 'vocabulary');
  var significance = AttributeHelper.attributeKey(xml, 'significance');

  // Text
  var name = AttributeHelper.attributeLanguage(xml, self.defaultLanguage);

  if (code && vocabulary) {
    code = code.replace(/ /g, '%20');
    vocabulary = vocabulary.replace(/ /g, '%20');

    self.graph.add(triple(
      self.iati + 'activity/' + self.id,
      self.iati + 'activity-policy-marker',
      self.iati + 'activity/' + self.id + '/policy-marker/' + vocabulary +
                  '/' + code
    ));

    self.graph.add(triple(
      self.iati + 'activity/' + self.id + '/policy-marker/' + vocabulary +
                  '/' + code,
      RDF_NS + 'type',
      self.iati + 'policy-marker'
    ));

    self.graph.add(triple(
      self.iati + 'activity/' + self.id + '/policy-marker/' + vocabulary +
                  '/' + code,
      self.iati + 'policy-marker-code',
      self.iati + 'codelist/PolicyMarker/' + code
    ));

    self.graph.add(triple(
      self.iati + 'activity/' + self.id + '/policy-marker/' + vocabulary +
                  '/' + code,
      self.iati + 'policy-marker-vocabulary',
      self.iati + 'codelist/Vocabulary/' + vocabulary
    ));

    if (significance) {
      significance = significance.replace(/ /g, '%20');

      self.graph.add(triple(
        self.iati + 'activity/' + self.id + '/policy-marker/' + vocabulary +
                    '/' + code,
        self.iati + 'significance-code',
        self.iati + 'codelist/PolicySignificance/' + significance
      ));
    }

    if (name) {
      self.graph.add(triple(
        self.iati + 'activity/' + self.id + '/policy-marker/' + vocabulary +
                    '/' + code,
        RDFS_NS + 'label',
        name
      ));
    }
  }
};

ActivityElements.prototype.collaborationType = function (xml) {
  var self = this;

  /*Converts the XML of the collaboration-type element to a RDFLib self.graph.

  Parameters
  @xml: The XML of this element.*/

  // Keys
  var code = AttributeHelper.attributeKey(xml, 'code');

  if (code) {
    code = code.replace(/ /g, '%20');

    self.graph.add(triple(
      self.iati + 'activity/' + self.id,
      self.iati + 'activity-collaboration-type',
      self.iati + 'codelist/CollaborationType/' + code
    ));
  }
};

ActivityElements.prototype.financeType = function (xml) {
  var self = this;

  /*Converts the XML of the default-finance-type element to a RDFLib self.graph.

  Parameters
  @xml: The XML of this element.*/

  // Keys
  var code = AttributeHelper.attributeKey(xml, 'code');

  if (code) {
    code = code.replace(/ /g, '%20');

    self.graph.add(triple(
      self.iati + 'activity/' + self.id,
      self.iati + 'activity-default-finance-type',
      self.iati + 'codelist/FinanceType/' + code
    ));
  }
};

ActivityElements.prototype.flowType = function (xml) {
  var self = this;

  /*Converts the XML of the default-flow-type element to a RDFLib self.graph.

  Parameters
  @xml: The XML of this element.*/

  // Keys
  var code = AttributeHelper.attributeKey(xml, 'code');

  if (code) {
    code = code.replace(/ /g, '%20');

    self.graph.add(triple(
      self.iati + 'activity/' + self.id,
      self.iati + 'activity-default-flow-type',
      self.iati + 'codelist/FlowType/' + code
    ));
  }
};

ActivityElements.prototype.aidType = function (xml) {
  var self = this;

  /*Converts the XML of the default-aid-type element to a RDFLib self.graph.

  Parameters
  @xml: The XML of this element.*/

  // Keys
  var code = AttributeHelper.attributeKey(xml, 'code');

  if (code) {
    code = code.replace(/ /g, '%20');

    self.graph.add(triple(
      self.iati + 'activity/' + self.id,
      self.iati + 'activity-default-aid-type',
      self.iati + 'codelist/AidType/' + code
    ));
  }
};

ActivityElements.prototype.tiedStatus = function (xml) {
  var self = this;

  /*Converts the XML of the default-tied-status element to a RDFLib self.graph.

  Parameters
  @xml: The XML of this element.*/

  // Keys
  var code = AttributeHelper.attributeKey(xml, 'code');

  if (code) {
    code = code.replace(/ /g, '%20');

    self.graph.add(triple(
      self.iati + 'activity/' + self.id,
      self.iati + 'activity-default-tied-status',
      self.iati + 'codelist/TiedStatus/' + code
    ));
  }
};

ActivityElements.prototype.budget = function (xml) {
  var self = this;

  /*Converts the XML of the budget element to a RDFLib self.graph.

  Parameters
  @xml: The XML of this element.*/

  // Keys
  var type = AttributeHelper.attributeKey(xml, 'type');

  // Elements
  var periodStart = xml.find('period-start');
  var periodEnd = xml.find('period-end');
  var value = xml.find('value');

  var date, periodStartDate, periodEndDate,
      periodStartText, periodEndText,
      valueText;

  // Create hash
  // Required: one of value,
  //  period-start (iso-date / text),
  //  period-end (iso-date / text);
  var hash = crypto.createHash('md5');
  var hashCreated = false;

  if (periodStart) {
    // Keys
    periodStartDate = AttributeHelper.attributeKey(periodStart, 'iso-date');
    if (periodStartDate) {
      hash.update(periodStartDate);
      hashCreated = true;
    }
    periodStartText = periodStart.text;
    if (periodStartText) {
      hash.update(periodStartText);
      hashCreated = true;
    }
  }
  if (periodEnd) {
    // Keys
    periodEndDate = AttributeHelper.attributeKey(periodEnd, 'iso-date');
    if (periodEndDate) {
      hash.update(periodEndDate);
      hashCreated = true;
    }
    periodEndText = periodEnd.text;
    if (periodEndText) {
      hash.update(periodEndText);
      hashCreated = true;
    }
  }
  if (value) {
    valueText = value.text;
    if (valueText) {
      hash.update(valueText);
      hashCreated = true;
    }
  }

  if (hashCreated) {
    var hashBudget = hash.digest('hex');

    self.graph.add(triple(
      self.iati + 'activity/' + self.id,
      self.iati + 'activity-budget',
      self.iati + 'activity/' + self.id + '/budget/' + hashBudget
    ));

    self.graph.add(triple(
      self.iati + 'activity/' + self.id + '/budget/' + hashBudget,
      RDF_NS + 'type',
      self.iati + 'budget'
    ));

    if (type) {
      type = type.replace(/ /g, '%20');

      self.graph.add(triple(
        self.iati + 'activity/' + self.id + '/budget/' + hashBudget,
        self.iati + 'budget-type',
        self.iati + 'codelist/BudgetType/' + type
      ));
    }

    if (periodStart) {
      // Keys
      date = AttributeHelper.attributeKey(periodStart, 'iso-date');

      // Text
      periodStartText =
        AttributeHelper.attributeLanguage(periodStart, self.defaultLanguage);

      if (date) {
        self.graph.add(triple(
          self.iati + 'activity/' + self.id + '/budget/' + hashBudget,
          self.iati + 'start-date',
          literal(date)
        ));
      }

      if (periodStartText) {
        self.graph.add(triple(
          self.iati + 'activity/' + self.id + '/budget/' + hashBudget,
          self.iati + 'start-date-text',
          periodStartText
        ));
      }
    }

    if (periodEnd) {
      // Keys
      date = AttributeHelper.attributeKey(periodEnd, 'iso-date');

      // Text
      periodEndText =
        AttributeHelper.attributeLanguage(periodEnd, self.defaultLanguage);

      if (date) {
        self.graph.add(triple(
          self.iati + 'activity/' + self.id + '/budget/' + hashBudget,
          self.iati + 'end-date',
          literal(date)
        ));
      }

      if (periodEndText) {
        self.graph.add(triple(
          self.iati + 'activity/' + self.id + '/budget/' + hashBudget,
          self.iati + 'end-date-text',
          periodEndText
        ));
      }
    }

    if (value) {
      // Keys
      var currency = AttributeHelper.attributeKey(value, 'currency');
      var valueDate = AttributeHelper.attributeKey(value, 'value-date');

      // Text
      valueText = value.text;

      if (valueText) {
        valueText = valueText.replace(/\s+/g, ' ');

        self.graph.add(triple(
          self.iati + 'activity/' + self.id + '/budget/' + hashBudget,
          self.iati + 'value',
          literal(valueText)
        ));

        if (currency) {
          currency = currency.replace(/ /g, '%20');

          self.graph.add(triple(
      self.iati + 'activity/' + self.id + '/budget/' + hashBudget,
            self.iati + 'value-currency',
            self.iati + 'codelist/Currency/' + currency
          ));
        }
        else if (self.defaultCurrency) {
          self.defaultCurrency = self.defaultCurrency.replace(/ /g, '%20');

          self.graph.add(triple(
            self.iati + 'activity/' + self.id + '/budget/' + hashBudget,
            self.iati + 'value-currency',
            self.iati + 'codelist/Currency/' + self.defaultCurrency
          ));
        }

        if (valueDate) {
          self.graph.add(triple(
            self.iati + 'activity/' + self.id + '/budget/' + hashBudget,
            self.iati + 'value-date',
            literal(valueDate)
          ));
        }
      }
    }
  }
};

ActivityElements.prototype.plannedDisbursement = function (xml) {
  var self = this;

  /*Converts the XML of the planned-disbursement element
    to a RDFLib self.graph.

  Parameters
  @xml: The XML of this element.*/

  // Keys
  var updated = AttributeHelper.attributeKey(xml, 'updated');

  // Elements
  var periodStart = xml.find('period-start');
  var periodEnd = xml.find('period-end');
  var value = xml.find('value');

  var date, periodStartText, periodEndText, valueText, hashPlannedDisbursement;

  // Create hash
  // Required: one of value,
  //  period-start (iso-date / text),
  //  period-end (iso-date / text);
  var hash = crypto.createHash('md5');
  var hashCreated = false;

  if (periodStart) {
    // Keys
    var periodStartDate = AttributeHelper.attributeKey(periodStart, 'iso-date');
    if (periodStartDate) {
      hash.update(periodStartDate);
      hashCreated = true;
    }
    periodStartText = periodStart.text;
    if (periodStartText) {
      hash.update(periodStartText);
      hashCreated = true;
    }
  }
  if (periodEnd) {
    // Keys
    var periodEndDate = AttributeHelper.attributeKey(periodEnd, 'iso-date');
    if (periodEndDate) {
      hash.update(periodEndDate);
      hashCreated = true;
    }
    periodEndText = periodEnd.text;
    if (periodEndText) {
      hash.update(periodEndText);
      hashCreated = true;
    }
  }
  if (value) {
    valueText = value.text;
    if (valueText) {
      hash.update(valueText);
      hashCreated = true;
    }
  }

  if (hashCreated) {
    hashPlannedDisbursement = hash.digest('hex');

    self.graph.add(triple(
      self.iati + 'activity/' + self.id,
      self.iati + 'activity-planned-disbursement',
      self.iati + 'activity/' + self.id +
                  '/planned-disbursement/' + hashPlannedDisbursement
    ));

    self.graph.add(triple(
      self.iati + 'activity/' + self.id +
                  '/planned-disbursement/' + hashPlannedDisbursement,
      RDF_NS + 'type',
      self.iati + 'planned-disbursement'
    ));

    if (updated) {
      self.graph.add(triple(
        self.iati + 'activity/' + self.id +
                    '/planned-disbursement/' + hashPlannedDisbursement,
        self.iati + 'updated',
        literal(updated)
      ));
    }

    if (periodStart) {
      // Keys
      date = AttributeHelper.attributeKey(periodStart, 'iso-date');

      // Text
      periodStartText =
        AttributeHelper.attributeLanguage(periodStart, self.defaultLanguage);

      if (date) {
        self.graph.add(triple(
          self.iati + 'activity/' + self.id +
                      '/planned-disbursement/' + hashPlannedDisbursement,
          self.iati + 'start-date',
          literal(date)
        ));
      }

      if (periodStartText) {
        self.graph.add(triple(
          self.iati + 'activity/' + self.id +
                      '/planned-disbursement/' + hashPlannedDisbursement,
          self.iati + 'start-date-text',
          periodStartText
        ));
      }
    }

    if (periodEnd) {
      // Keys
      date = AttributeHelper.attributeKey(periodEnd, 'iso-date');

      // Text
      periodEndText =
        AttributeHelper.attributeLanguage(periodEnd, self.defaultLanguage);

      if (date) {
        self.graph.add(triple(
          self.iati + 'activity/' + self.id +
                      '/planned-disbursement/' + hashPlannedDisbursement,
          self.iati + 'end-date',
          literal(date)
        ));
      }

      if (periodEndText) {
        self.graph.add(triple(
          self.iati + 'activity/' + self.id +
                      '/planned-disbursement/' + hashPlannedDisbursement,
          self.iati + 'end-date-text',
          periodEndText
        ));
      }
    }

    if (value) {
      // Keys
      var currency = AttributeHelper.attributeKey(value, 'currency');
      var valueDate = AttributeHelper.attributeKey(value, 'value-date');

      // Text
      valueText = value.text;

      if (valueText) {
        valueText = valueText.replace(/\s+/g, ' ');

        self.graph.add(triple(
          self.iati + 'activity/' + self.id +
                      '/planned-disbursement/' + hashPlannedDisbursement,
          self.iati + 'value',
          literal(valueText)
        ));

        if (currency) {
          currency = currency.replace(/ /g, '%20');

          self.graph.add(triple(
            self.iati + 'activity/' + self.id +
                        '/planned-disbursement/' + hashPlannedDisbursement,
            self.iati + 'value-currency',
            self.iati + 'codelist/Currency/' + currency
          ));
        }
        else if (self.defaultCurrency) {
          self.defaultCurrency = self.defaultCurrency.replace(/ /g, '%20');

          self.graph.add(triple(
            self.iati + 'activity/' + self.id +
                        '/planned-disbursement/' + hashPlannedDisbursement,
            self.iati + 'value-currency',
            self.iati + 'codelist/Currency/' + self.defaultCurrency
          ));
        }

        if (valueDate) {
          self.graph.add(triple(
            self.iati + 'activity/' + self.id +
                        '/planned-disbursement/' + hashPlannedDisbursement,
            self.iati + 'value-date',
            literal(valueDate)
          ));
        }
      }
    }
  }
};

ActivityElements.prototype.transaction = function (xml) {
  var self = this;

  /*Converts the XML of the transaction element to a RDFLib self.graph.

  Parameters
  @xml: The XML of this element.*/

  // Keys
  var ref = AttributeHelper.attributeKey(xml, 'ref');

  // Elements
  var aidType = xml.find('aid-type');
  var descriptions = xml.findall('description');
  var disbursementChannel = xml.find('disbursement-channel');
  var financeType = xml.find('finance-type');
  var flowType = xml.find('flow-type');
  var providerOrg = xml.find('provider-org');
  var receiverOrg = xml.find('receiver-org');
  var tiedStatus = xml.find('tied-status');
  var transactionDate = xml.find('transaction-date');
  var transactionType = xml.find('transaction-type');
  var value = xml.find('value');

  var code, isoDate;

  // Create hash
  // Required: one of value, description, transaction date

  var hash = crypto.createHash('md5');
  var hashCreated = false;

  var valueText = AttributeHelper.attributeText(xml, 'value');
  if (valueText) {
    hash.update(valueText[0]);
    hashCreated = true;
  }
  var descriptionText = AttributeHelper.attributeText(xml, 'description');
  if (descriptionText) {
    hash.update(descriptionText[0]);
    hashCreated = true;
  }
  if (transactionDate) {
    // Keys
    isoDate = AttributeHelper.attributeKey(transactionDate, 'iso-date');
    if (isoDate) {
      hash.update(isoDate);
      hashCreated = true;
    }
  }

  if (hashCreated || ref) {
    var hashTransaction = hash.digest('hex');
    var transactionId;

    if (ref) {
      var refUrl = ref.replace(/ /g, '%20');

      transactionId =
        self.iati + 'activity/' + self.id + '/transaction/' + refUrl;

      self.graph.add(triple(
        transactionId,
        self.iati + 'transaction-ref',
        literal(ref)
      ));
    }
    else {
      transactionId =
        self.iati + 'activity/' + self.id + '/transaction/' + hashTransaction;
    }

    self.graph.add(triple(
      self.iati + 'activity/' + self.id,
      self.iati + 'activity-transaction',
      transactionId
    ));

    self.graph.add(triple(
      transactionId,
      RDF_NS + 'type',
      self.iati + 'transaction'
    ));

    if (aidType) {
      // Keys
      code = AttributeHelper.attributeKey(aidType, 'code');

      if (code) {
        code = code.replace(/ /g, '%20');

        self.graph.add(triple(
          transactionId,
          self.iati + 'aid-type',
          self.iati + 'codelist/AidType/' + code
        ));
      }

      else if (self.defaultAidType) {
        self.defaultAidType = self.defaultAidType.replace(/ /g, '%20');

        self.graph.add(triple(
          transactionId,
          self.iati + 'aid-type',
          self.iati + 'codelist/AidType/' + self.defaultAidType
        ));
      }
    }

    else if (self.defaultAidType) {
      self.defaultAidType = self.defaultAidType.replace(/ /g, '%20');

      self.graph.add(triple(
        transactionId,
        self.iati + 'aid-type',
        self.iati + 'codelist/AidType/' + self.defaultAidType
      ));
    }

    if (descriptions.length !== 0) {
      descriptions.forEach(function(description) {
        // Keys
        var type = AttributeHelper.attributeKey(description, 'type');

        // Text
        var descriptionText =
          AttributeHelper.attributeLanguage(description, self.defaultLanguage);

        if (descriptionText) {

          // Create hash
          // Required: description

          var hashDescription = crypto.createHash('md5');

          var descriptionNolanguage = description.text;
          hashDescription.update(descriptionNolanguage);

          var hashTransactionDescription = hashDescription.digest('hex');

          self.graph.add(triple(
            transactionId,
            self.iati + 'transaction-description',
            transactionId + '/description/' + hashTransactionDescription
          ));

          self.graph.add(triple(
            transactionId + '/description/' + hashTransactionDescription,
            RDF_NS + 'type',
            self.iati + 'description'
          ));

          self.graph.add(triple(
            transactionId + '/description/' + hashTransactionDescription,
            self.iati + 'description-text',
            descriptionText
          ));

          if (type) {
            type = type.replace(/ /g, '%20');

            self.graph.add(triple(
              transactionId + '/description/' + hashTransactionDescription,
              self.iati + 'description-type',
              self.iati + 'codelist/DescriptionType/' + type
            ));
          }
        }
      });
    }

    if (disbursementChannel) {
      // Keys
      code = AttributeHelper.attributeKey(disbursementChannel, 'code');

      if (code) {
        code = code.replace(/ /g, '%20');

        self.graph.add(triple(
          transactionId,
          self.iati + 'disbursement-channel',
          self.iati + 'codelist/disbursementChannel/' + code
        ));
      }
    }

    if (financeType) {
      // Keys
      code = AttributeHelper.attributeKey(financeType, 'code');

      if (code) {
        code = code.replace(/ /g, '%20');

        self.graph.add(triple(
          transactionId,
          self.iati + 'finance-type',
          self.iati + 'codelist/FinanceType/' + code
        ));
      }

      else if (self.defaultFinanceType) {
        self.defaultFinanceType = self.defaultFinanceType.replace(/ /g, '%20');

        self.graph.add(triple(
          transactionId,
          self.iati + 'finance-type',
          self.iati + 'codelist/FinanceType/' + self.defaultFinanceType
        ));
      }
    }

    else if (self.defaultFinanceType) {
      self.defaultFinanceType = self.defaultFinanceType.replace(/ /g, '%20');

      self.graph.add(triple(
        transactionId,
        self.iati + 'finance-type',
        self.iati + 'codelist/FinanceType/' + self.defaultFinanceType
      ));
    }

    if (flowType) {
      // Keys
      code = AttributeHelper.attributeKey(flowType, 'code');

      if (code) {
        code = code.replace(/ /g, '%20');

        self.graph.add(triple(
          transactionId,
          self.iati + 'flow-type',
          self.iati + 'codelist/FlowType/' + code
        ));
      }

      else if (self.defaultFlowType) {
        self.defaultFlowType = self.defaultFlowType.replace(/ /g, '%20');

        self.graph.add(triple(
          transactionId,
          self.iati + 'flow-type',
          self.iati + 'codelist/FlowType/' + self.defaultFlowType
        ));
      }
    }

    else if (self.defaultFlowType) {
      self.defaultFlowType = self.defaultFlowType.replace(/ /g, '%20');

      self.graph.add(triple(
        transactionId,
        self.iati + 'flow-type',
        self.iati + 'codelist/FlowType/' + self.defaultFlowType
      ));
    }

    if (providerOrg) {
      // Keys
      ref = AttributeHelper.attributeKey(providerOrg, 'ref');
      var providerActivityId =
        AttributeHelper.attributeKey(providerOrg, 'provider-activity-id');

      // Text
      var providerOrgText = providerOrg.text;

      if (providerOrgText) {
        providerOrgText = providerOrgText.replace(/\s+/g, ' ');

        self.graph.add(triple(
          transactionId,
          self.iati + 'provider-org-name',
          literal(providerOrgText)
        ));
      }

      if (ref) {
        ref = ref.replace(/ /g, '%20');

        self.graph.add(triple(
          transactionId,
          self.iati + 'provider-org',
          self.iati + 'codelist/OrganisationIdentifier/' + ref
        ));
      }

      if (providerActivityId) {
        providerActivityId = providerActivityId.replace(/ /g, '%20');

        self.graph.add(triple(
          transactionId,
          self.iati + 'provider-org-activity-id',
          self.iati + 'activity/' + providerActivityId
        ));
      }
    }

    if (receiverOrg) {
      // Keys
      ref = AttributeHelper.attributeKey(receiverOrg, 'ref');
      var receiverActivityId =
        AttributeHelper.attributeKey(receiverOrg, 'receiver-activity-id');

      // Text
      var receiverOrgText = receiverOrg.text;

      if (receiverOrgText) {
        receiverOrgText = receiverOrgText.replace(/\s+/g, ' ');

        self.graph.add(triple(
          transactionId,
          self.iati + 'receiver-org-name',
          literal(receiverOrgText)
        ));
      }

      if (ref) {
        ref = ref.replace(/ /g, '%20');

        self.graph.add(triple(
          transactionId,
          self.iati + 'receiver-org',
          self.iati + 'codelist/OrganisationIdentifier/' + ref
        ));
      }

      if (receiverActivityId) {
        receiverActivityId = receiverActivityId.replace(/ /g, '%20');

        self.graph.add(triple(
          transactionId,
          self.iati + 'receiver-org-activity-id',
          self.iati + 'activity/' + receiverActivityId
        ));
      }
    }

    if (tiedStatus) {
      // Keys
      code = AttributeHelper.attributeKey(tiedStatus, 'code');

      if (code) {
        code = code.replace(/ /g, '%20');

        self.graph.add(triple(
          transactionId,
          self.iati + 'tied-status',
          self.iati + 'codelist/TiedStatus/' + code
        ));
      }

      else if (self.defaultTiedStatus) {
        self.defaultTiedStatus = self.defaultTiedStatus.replace(/ /g, '%20');

        self.graph.add(triple(
          transactionId,
          self.iati + 'tied-status',
          self.iati + 'codelist/TiedStatus/' + self.defaultTiedStatus
        ));
      }
    }

    else if (self.defaultTiedStatus) {
      self.defaultTiedStatus = self.defaultTiedStatus.replace(/ /g, '%20');

      self.graph.add(triple(
        transactionId,
        self.iati + 'tied-status',
        self.iati + 'codelist/TiedStatus/' + self.defaultTiedStatus
      ));
    }

    if (transactionDate) {
      // Keys
      isoDate = AttributeHelper.attributeKey(transactionDate, 'iso-date');

      if (isoDate) {
        self.graph.add(triple(
          transactionId,
          self.iati + 'transaction-date',
          literal(isoDate)
        ));
      }
    }

    if (transactionType) {
      // Keys
      code = AttributeHelper.attributeKey(transactionType, 'code');

      if (code) {
        code = code.replace(/ /g, '%20');

        self.graph.add(triple(
          transactionId,
          self.iati + 'transaction-type',
          self.iati + 'codelist/TransactionType/' + code
        ));
      }
    }

    if (value) {
      // Keys
      var currency = AttributeHelper.attributeKey(value, 'currency');
      var valueDate = AttributeHelper.attributeKey(value, 'value-date');

      // Text
      valueText = value.text;

      if (valueText) {
        valueText = valueText.replace(/\s+/g, ' ');

        self.graph.add(triple(
          transactionId,
          self.iati + 'value',
          literal(valueText)
        ));

        if (currency) {
          currency = currency.replace(/ /g, '%20');

          self.graph.add(triple(
            transactionId,
            self.iati + 'value-currency',
            self.iati + 'codelist/Currency/' + currency
          ));
        }

        else if (self.defaultCurrency) {
          self.defaultCurrency = self.defaultCurrency.replace(/ /g, '%20');

          self.graph.add(triple(
            transactionId,
            self.iati + 'value-currency',
            self.iati + 'codelist/Currency/' + self.defaultCurrency
          ));
        }

        if (valueDate) {
          self.graph.add(triple(
            transactionId,
            self.iati + 'value-date',
            literal(valueDate)
          ));
        }
      }
    }
  }
};

ActivityElements.prototype.documentLink = function (xml) {
  var self = this;

  /*Converts the XML of the document-link element to a RDFLib self.graph.

  Parameters
  @xml: The XML of this element.*/

  // Keys
  var url = AttributeHelper.attributeKey(xml, 'url');
  var format = AttributeHelper.attributeKey(xml, 'format');

  // Elements
  var titles = xml.findall('title');
  var category = xml.find('category');
  var languages = xml.findall('language');

  if (url) {
    // Create hash
    // Required: url

    var hash = crypto.createHash('md5');
    hash.update(url);

    var hashDocumentLink = hash.digest('hex');

    url = url.replace(/ /g, '%20');

    self.graph.add(triple(
      self.iati + 'activity/' + self.id,
      self.iati + 'activity-document-link',
      self.iati + 'activity/' + self.id + 'document-link/' + hashDocumentLink
    ));

    self.graph.add(triple(
      self.iati + 'activity/' + self.id + 'document-link/' + hashDocumentLink,
      RDF_NS + 'type',
      self.iati + 'document-link'
    ));

    self.graph.add(triple(
      self.iati + 'activity/' + self.id + 'document-link/' + hashDocumentLink,
      self.iati + 'url',
      url
    ));

    if (format) {
      format = format.replace(/ /g, '%20');

      self.graph.add(triple(
        self.iati + 'activity/' + self.id + 'document-link/' + hashDocumentLink,
        self.iati + 'format',
        self.iati + 'codelist/FileFormat/' + format
      ));
    }

    if (titles.length !== 0) {
      titles.forEach(function(title) {
        // Text
        var name =
          AttributeHelper.attributeLanguage(title, self.defaultLanguage);

        if (name) {
          self.graph.add(triple(
            self.iati + 'activity/' + self.id +
                        'document-link/' + hashDocumentLink,
            RDFS_NS + 'label',
            name
          ));
        }
      });
    }

    if (category) {
      // Keys
      var code = AttributeHelper.attributeKey(category, 'code');

      if (code) {
        code = code.replace(/ /g, '%20');

        self.graph.add(triple(
          self.iati + 'activity/' + self.id +
                      'document-link/' + hashDocumentLink,
          self.iati + 'document-category',
          self.iati + 'codelist/DocumentCategory/' + code
        ));
      }
    }

    if (languages.length !== 0) {
      languages.forEach(function(language) {
        // Keys
        var code = AttributeHelper.attributeKey(language, 'code');

        // Text
        var name =
          AttributeHelper.attributeLanguage(language, self.defaultLanguage);

        if (code) {
          self.graph.add(triple(
            self.iati + 'activity/' + self.id +
                        'document-link/' + hashDocumentLink,
            self.iati + 'language',
            literal(code)
          ));
        }

        if (name) {
          self.graph.add(triple(
            self.iati + 'activity/' + self.id +
                        'document-link/' + hashDocumentLink,
            self.iati + 'language-text',
            name
          ));
        }
      });
    }
  }
};

ActivityElements.prototype.relatedActivity = function (xml) {
  var self = this;

  /*Converts the XML of the related-activity element to a RDFLib self.graph.

  Parameters
  @xml: The XML of this element.*/

  // Keys
  var ref = AttributeHelper.attributeKey(xml, 'ref');
  var type = AttributeHelper.attributeKey(xml, 'type');

  // Text
  var name = AttributeHelper.attributeLanguage(xml, self.defaultLanguage);

  if (ref) {
    ref = ref.replace(/ /g, '%20');

    self.graph.add(triple(
      self.iati + 'activity/' + self.id,
      self.iati + 'related-activity',
      self.iati + 'activity/' + self.id + '/related-activity/' + ref
    ));

    self.graph.add(triple(
      self.iati + 'activity/' + self.id + '/related-activity/' + ref,
      self.iati + 'activity',
      self.iati + 'activity/' + ref
    ));

    self.graph.add(triple(
      self.iati + 'activity/' + self.id + '/related-activity/' + ref,
      self.iati + 'related-activity-id',
      literal(ref)
    ));

    if (type) {
      type = type.replace(/ /g, '%20');

      self.graph.add(triple(
        self.iati + 'activity/' + self.id + '/related-activity/' + ref,
        self.iati + 'related-activity-type',
        self.iati + 'codelist/RelatedActivityType/' + type
      ));
    }

    if (name) {
      self.graph.add(triple(
        self.iati + 'activity/' + self.id + '/related-activity/' + ref,
        RDFS_NS + 'label',
        name
      ));
    }
  }
};

ActivityElements.prototype.conditions = function (xml) {
  var self = this;

  /*Converts the XML of the conditions element to a RDFLib self.graph.

  Parameters
  @xml: The XML of this element.*/

  // Elements
  var conditionsContainer = xml.find('conditions');
  var conditions = conditionsContainer.findall('condition');

  if (conditions.length !== 0) {

    conditions.forEach(function(condition) {
      // Keys
      var type = AttributeHelper.attributeKey(condition, 'type');

      // Text
      var conditionText =
        AttributeHelper.attributeLanguage(condition, self.defaultLanguage);

      if (conditionText) {
        var conditionTextText = condition.text;

        //Create hash
        var hash = crypto.createHash('md5');
        hash.update(conditionTextText);

        var hashCondition = hash.digest('hex');

        self.graph.add(triple(
          self.iati + 'activity/' + self.id,
          self.iati + 'activity-condition',
          self.iati + 'activity/' + self.id +
                      '/condition/' + hashCondition
        ));

        self.graph.add(triple(
          self.iati + 'activity/' + self.id + '/condition/' + hashCondition,
          RDF_NS + 'type',
          self.iati + 'condition'
        ));

        self.graph.add(triple(
          self.iati + 'activity/' + self.id + '/condition/' + hashCondition,
          RDFS_NS + 'label',
          conditionText
        ));

        if (type) {
          type = type.replace(/ /g, '%20');

          self.graph.add(triple(
            self.iati + 'activity/' + self.id + '/condition/' + hashCondition,
            self.iati + 'condition-type',
            self.iati + 'codelist/ConditionType/' + type
          ));
        }
      }
    });
  }
};

ActivityElements.prototype.result = function (xml) {
  var self = this;

  /*Converts the XML of the conditions element to a RDFLib self.graph.

  Parameters
  @xml: The XML of this element.*/

  // Keys
  var type = AttributeHelper.attributeKey(xml, 'type');
  var aggregationStatus =
    AttributeHelper.attributeKey(xml, 'aggregation-status');

  // Elements
  var titles = xml.findall('title');
  var descriptions = xml.findall('description');
  var indicators = xml.findall('indicator');

  var value, date;

  // Create hash
  // Required: one of title or description

  var hash = crypto.createHash('md5');
  var hashCreated = false;

  var resultTitle = AttributeHelper.attributeText(xml, 'title');
  if (resultTitle) {
    hash.update(resultTitle[0]);
    hashCreated = true;
  }
  var resultDescription = AttributeHelper.attributeText(xml, 'description');
  if (resultDescription) {
    hash.update(resultDescription[0]);
    hashCreated = true;
  }

  if (hashCreated) {
    var hashResult = hash.digest('hex');

    self.graph.add(triple(
      self.iati + 'activity/' + self.id,
      self.iati + 'activity-result',
      self.iati + 'activity/' + self.id + '/result/' + hashResult
    ));

    self.graph.add(triple(
      self.iati + 'activity/' + self.id + '/result/' + hashResult,
      RDF_NS + 'type',
      self.iati + 'result'
    ));

    if (titles.length !== 0) {
      titles.forEach(function(title) {
        // Text
        var titleText =
          AttributeHelper.attributeLanguage(title, self.defaultLanguage);

        if (titleText) {
          self.graph.add(triple(
            self.iati + 'activity/' + self.id + '/result/' + hashResult,
            RDFS_NS + 'label',
            titleText
          ));
        }
      });
    }

    if (descriptions.length !== 0) {
      descriptions.forEach(function(description) {
        // Keys
        var type = AttributeHelper.attributeKey(description, 'type');

        // Text
        var descriptionText =
          AttributeHelper.attributeLanguage(description, self.defaultLanguage);

        if (descriptionText) {
          // Create hash
          // Required: description

          var hashDescription = crypto.createHash('md5');

          var descriptionNolanguage = description.text;
          hashDescription.update(descriptionNolanguage);

          var hashLocationDescription = hashDescription.digest('hex');

          self.graph.add(triple(
            self.iati + 'activity/' + self.id + '/result/' + hashResult,
            self.iati + 'result-description',
            self.iati + 'activity/' + self.id + '/result/' + hashResult +
                  '/description/' + hashLocationDescription));

          self.graph.add(triple(
            self.iati + 'activity/' + self.id + '/result/' + hashResult +
                  '/description/' + hashLocationDescription,
            RDF_NS + 'type',
            self.iati + 'description'));

          self.graph.add(triple(
            self.iati + 'activity/' + self.id + '/result/' + hashResult +
                  '/description/' + hashLocationDescription,
            self.iati + 'description-text',
            descriptionText));

          if (type) {
            type = type.replace(/ /g, '%20');

            self.graph.add(triple(
              self.iati + 'activity/' + self.id + '/result/' + hashResult +
                    '/description/' + hashLocationDescription,
              self.iati + 'description-type',
              self.iati + 'codelist/DescriptionType/' + type));
          }
        }
      });
    }

    if (indicators.length !== 0) {

      indicators.forEach(function(indicator) {
        // Create hash
        // Required: one of title or description

        var hash = crypto.createHash('md5');
        var hashCreated = false;

        var indicatorTitle = AttributeHelper.attributeText(indicator, 'title');
        if (indicatorTitle) {
          hash.update(indicatorTitle[0]);
          hashCreated = true;
        }
        var indicatorDescription =
          AttributeHelper.attributeText(indicator, 'description');
        if (indicatorDescription) {
          hash.update(indicatorDescription[0]);
          hashCreated = true;
        }

        if (hashCreated) {
          var hashResultIndicator = hash.digest('hex');

          // Keys
          var measure = AttributeHelper.attributeKey(indicator, 'measure');
          var ascending = AttributeHelper.attributeKey(indicator, 'ascending');

          // Elements
          titles = indicator.findall('title');
          descriptions = indicator.findall('description');
          var periods = indicator.findall('indicator');
          var baseline = indicator.find('baseline');

          self.graph.add(triple(
            self.iati + 'activity/' + self.id + '/result/' + hashResult,
            self.iati + 'result-indicator',
            self.iati + 'activity/' + self.id + '/result/' + hashResult +
                        '/indicator/' + hashResultIndicator));

          self.graph.add(triple(
            self.iati + 'activity/' + self.id + '/result/' + hashResult +
                        '/indicator/' + hashResultIndicator,
            RDF_NS + 'type',
            self.iati + 'indicator'));

          if (measure) {
            measure = measure.replace(/ /g, '%20');

            self.graph.add(triple(
              self.iati + 'activity/' + self.id + '/result/' + hashResult +
                         '/indicator/' + hashResultIndicator,
              self.iati + 'indicator-measure',
              self.iati + 'codelist/IndicatorMeasure/' + measure));
          }

          if (ascending) {
            self.graph.add(triple(
              self.iati + 'activity/' + self.id + '/result/' + hashResult +
                          '/indicator/' + hashResultIndicator,
              self.iati + 'indicator-ascending',
              literal(ascending)));
          }
          else {
            self.graph.add(triple(
              self.iati + 'activity/' + self.id + '/result/' + hashResult +
                          '/indicator/' + hashResultIndicator,
              self.iati + 'indicator-ascending',
              literal('true')));
          }

          if (titles.length !== 0) {
            titles.forEach(function(title) {
              // Text
              var titleText =
                AttributeHelper.attributeLanguage(title, self.defaultLanguage);

              if (titleText) {
                self.graph.add(triple(
                  self.iati + 'activity/' + self.id + '/result/' + hashResult +
                              '/indicator/' + hashResultIndicator,
                  RDFS_NS + 'label',
                  titleText));
              }
            });
          }

          if (descriptions.length !== 0) {
            descriptions.forEach(function(description) {
              // Keys
              var type = AttributeHelper.attributeKey(description, 'type');

              // Text
              var descriptionText =
                AttributeHelper
                  .attributeLanguage(description, self.defaultLanguage);

              // Create hash
              // Required: description

              var hashIndicatorDescription = crypto.createHash('md5');

              var descriptionNolanguage = description.text;
              hashIndicatorDescription.update(descriptionNolanguage);

              var hashResultIndicatorDescription =
                hashIndicatorDescription.digest('hex');

              if (descriptionText) {
                self.graph.add(triple(
                  self.iati + 'activity/' + self.id + '/result/' + hashResult +
                  '/indicator/' + hashResultIndicator,
                  self.iati + 'indicator-description',
                  self.iati + 'activity/' + self.id + '/result' + hashResult +
                  '/indicator/' + hashResultIndicator + '/description/' +
                  hashResultIndicatorDescription));

                self.graph.add(triple(
                  self.iati + 'activity/' + self.id + '/result' + hashResult +
                  '/indicator/' + hashResultIndicator + '/description/' +
                  hashResultIndicatorDescription,
                  RDF_NS + 'type',
                  self.iati + 'description'));

                self.graph.add(triple(
                  self.iati + 'activity/' + self.id + '/result' + hashResult +
                  '/indicator/' + hashResultIndicator + '/description/' +
                  hashResultIndicatorDescription,
                  self.iati + 'description-text',
                  descriptionText));

                if (type) {
                  type = type.replace(/ /g, '%20');

                  self.graph.add(triple(
                    self.iati + 'activity/' + self.id + '/result' + hashResult +
                  '/indicator/' + hashResultIndicator + '/description/' +
                  hashResultIndicatorDescription,
                    self.iati + 'description-type',
                    self.iati + 'codelist/DescriptionType/' + type));
                }
              }
            });
          }

          if (periods.length !== 0) {
            periods.forEach(function(period) {
              // Elements
              var periodStart = period.find('period-start');
              var periodEnd = period.find('period-end');
              var target = period.find('target');
              var actual = period.find('actual');

              // Create hash
              // Required: one of period-start (iso-date / text),
              //  period-end (iso-date / text);
              var hashIndicatorPeriod = crypto.createHash('md5');
              var hashIndicatorPeriodCreated = false;

              if (periodStart) {
                // Keys
                var periodStartDate =
                  AttributeHelper.attributeKey(periodStart, 'iso-date');
                if (periodStartDate) {
                  hashIndicatorPeriod.update(periodStartDate);
                  hashIndicatorPeriodCreated = true;
                }
                periodStartText = periodStart.text;
                if (periodStartText) {
                  hashIndicatorPeriod.update(periodStartText);
                  hashIndicatorPeriodCreated = true;
                }
              }
              if (periodEnd) {
                // Keys
                var periodEndDate =
                  AttributeHelper.attributeKey(periodEnd, 'iso-date');
                if (periodEndDate) {
                  hashIndicatorPeriod.update(periodEndDate);
                  hashIndicatorPeriodCreated = true;
                }
                periodEndText = periodEnd.text;
                if (periodEndText) {
                  hashIndicatorPeriod.update(periodEndText);
                  hashIndicatorPeriodCreated = true;
                }
              }

              if (hashIndicatorPeriodCreated) {

                var hashResultIndicatorPeriod =
                  hashIndicatorPeriod.digest('hex');

                self.graph.add(triple(
                  self.iati + 'activity/' + self.id + '/result/' + hashResult +
                              '/indicator/' + hashResultIndicator,
                  self.iati + 'indicator-period',
                  self.iati + 'activity/' + self.id + '/result/' + hashResult +
                              '/indicator/' + hashResultIndicator + '/period/' +
                              hashResultIndicatorPeriod));

                self.graph.add(triple(
                  self.iati + 'activity/' + self.id + '/result/' + hashResult +
                              '/indicator/' + hashResultIndicator + '/period/' +
                              hashResultIndicatorPeriod,
                  RDF_NS + 'type',
                  self.iati + 'period'));

                if (periodStart) {
                  // Keys
                  date = AttributeHelper.attributeKey(periodStart, 'iso-date');

                  // Text
                  var periodStartText =
                    AttributeHelper
                      .attributeLanguage(periodStart, self.defaultLanguage);

                  if (date) {
                    self.graph.add(triple(
                      self.iati + 'activity/' + self.id + '/result/' +
                        hashResult + '/indicator/' + hashResultIndicator +
                        '/period/' + hashResultIndicatorPeriod,
                      self.iati + 'start-date',
                      literal(date)));
                  }

                  if (periodStartText) {
                    self.graph.add(triple(
                      self.iati + 'activity/' + self.id + '/result/' +
                        hashResult + '/indicator/' + hashResultIndicator +
                        '/period/' + hashResultIndicatorPeriod,
                      self.iati + 'start-date-text',
                      periodStartText));
                  }
                }

                if (periodEnd) {
                  // Keys
                  date = AttributeHelper.attributeKey(periodEnd, 'iso-date');

                  // Text
                  var periodEndText =
                    AttributeHelper
                      .attributeLanguage(periodEnd, self.defaultLanguage);

                  if (date) {
                    self.graph.add(triple(
                      self.iati + 'activity/' + self.id + '/result/' +
                        hashResult + '/indicator/' + hashResultIndicator +
                        '/period/' + hashResultIndicatorPeriod,
                      self.iati + 'end-date',
                      literal(date)));
                  }

                  if (periodEndText) {
                    self.graph.add(triple(
                      self.iati + 'activity/' + self.id + '/result/' +
                        hashResult + '/indicator/' + hashResultIndicator +
                        '/period/' + hashResultIndicatorPeriod,
                      self.iati + 'end-date-text',
                      periodEndText));
                  }
                }

                var value;
                if (target) {
                  // Keys
                  value = AttributeHelper.attributeKey(target, 'value');

                  if (value) {
                    self.graph.add(triple(
                      self.iati + 'activity/' + self.id + '/result/' +
                        hashResult + '/indicator/' + hashResultIndicator +
                        '/period/' + hashResultIndicatorPeriod,
                      self.iati + 'period-target',
                      literal(value)));
                  }
                }

                if (actual) {
                  // Keys
                  value = AttributeHelper.attributeKey(actual, 'value');

                  if (value) {
                    self.graph.add(triple(
                      self.iati + 'activity/' + self.id + '/result/' +
                        hashResult + '/indicator/' + hashResultIndicator +
                        '/period/' + hashResultIndicatorPeriod,
                      self.iati + 'period-actual',
                      literal(value)));
                  }
                }
              }
            });
          }

          if (baseline) {
            // Keys
            var year = AttributeHelper.attributeKey(baseline, 'year');
            var value = AttributeHelper.attributeKey(baseline, 'value');

            // Elements
            var comment = baseline.find('comment');

            if (value) {
              self.graph.add(triple(
                self.iati + 'activity/' + self.id + '/result/' + hashResult +
                      '/indicator/' + hashResultIndicator,
                self.iati + 'baseline-value',
                literal(value)));
            }

            if (year) {
              self.graph.add(triple(
                self.iati + 'activity/' + self.id + '/result/' + hashResult +
                      '/indicator/' + hashResultIndicator,
                self.iati + 'baseline-year',
                literal(year)));
            }

            if (comment) {
              // Text
              var commentText =
                AttributeHelper
                  .attributeLanguage(comment, self.defaultLanguage);

              if (commentText) {
                self.graph.add(triple(
                  self.iati + 'activity/' + self.id + '/result/' + hashResult +
                  '/indicator/' + hashResultIndicator,
                  self.iati + 'baseline-comment',
                  commentText));
              }
            }
          }
        }
      });
    }
  }
};

/*
  TODO:
    - CodelistElements (~200 loc)
    - OrganisationElements (~800 loc)
    - ProvenanceElements (~900 loc)
 */