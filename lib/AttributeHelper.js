var rdf = require('rdf');

var whitespace = /\s+/g;
function clean(text) {
  return text.replace(whitespace, ' ');
}

exports.attributeKey = function attributeKey(xml, key) {
  try {
    if (xml.attrib[key] !== '') {
      return clean(xml.attrib[key]);
    }
  }
  catch (e) {}

  return null;
};

exports.attributeText = function attributeText(xml, attribute) {
  var valueList = [];

  try {
    xml.findall(attribute).forEach(function(element) {
      valueList.push(clean(element.text));
    });

    if (valueList.length !== 0) {
      return valueList;
    }
  }
  catch (e) {}

  return null;
};

exports.attributeLanguage = function attributeLanguage(xml, language) {
  if (xml.text.length === 0) {
    return null;
  }

  var nodeLanguage =
    exports.attributeKey(xml, '{http://www.w3.org/XML/1998/namespace}lang');

  var formattedText = clean(xml.text);

  if (nodeLanguage) {
    return new rdf.Literal(formattedText, '@' + nodeLanguage.toLowerCase());
  }

  if (language) {
    return new rdf.Literal(formattedText, '@' + language.toLowerCase());
  }

  return new rdf.Literal(formattedText);
};