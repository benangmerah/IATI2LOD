## IatiConvert.py
## By Kasper Brandt
## Last updated on 08-04-2013

from rdflib import Namespace, Literal, XSD, URIRef, Graph
import xml.etree.ElementTree as ET
from IatiElements import IatiElements
import AttributeHelper


class iati_activity :
    '''Class for converting a IATI activity XML to a RDFLib Graph.'''
    
    def __init__(self, xml):
        '''Initializes the codelist class.
        
        Parameters
        @xml: An ElementTree of an activity.'''
        
        self.xml = xml
        
        self.id = self.get_id()
        
        self.possible_keys = dict([('iati-activity', ['version',
                                                      'last-updated-datetime',
                                                      'default-currency',
                                                      'hierarchy',
                                                      'linked-data-uri',
                                                      '{http://www.w3.org/XML/1998/namespace}lang']),
                                   ('title', ['{http://www.w3.org/XML/1998/namespace}lang'])])


    def get_last_update(self):
        '''Gets the last update DateTime of the activity.
        
        Returns
        @last_update: A DateTime of the last update.'''
        
        return AttributeHelper.attribute_key(self.xml, 'last-updated-datetime')

    
    def get_id(self):
        '''Returns the ID of the activity.
        
        Returns
        @activity_id: The ID of the activity.'''
        
        id = AttributeHelper.attribute_text(self.xml, 'iati-identifier')
        
        if not id == None:
            return str(id[0].split()[0])
        
        return id
    
    def get_default_currency(self):
        '''Returns the default currency of the activity.
        
        Returns
        @default_currency: The default currency of the activity.'''
        
        default_currency = AttributeHelper.attribute_text(self.xml, 'default-currency')
        
        if not default_currency == None:
            return default_currency[0]
        
        return default_currency
        
    def get_default_language(self):
        '''Returns the default language of the activity.
        
        Returns
        @default_language: The default language of the activity.'''
        
        default_language = AttributeHelper.attribute_key(self.xml, '{http://www.w3.org/XML/1998/namespace}lang')
        
        return default_language
    
    def get_default_type(self, type):
        '''Returns a default type of the activity.
        
        Parameters
        @type: The element that should be retrieved.
        
        Returns
        @default_type: The default finance type of the activity.'''
        
        default_type = self.xml.find(type)
        
        if default_type == None:
            return None
        
        return AttributeHelper.attribute_key(default_type, 'code') 
    
    def get_defaults(self):
        '''Returns the defaults of the activity.
        
        Returns
        @defaults: A dictionary containing the defaults of the activity.'''
        
        defaults = dict([('id', self.id),
                         ('language', self.get_default_language()),
                         ('currency', self.get_default_currency()),
                         ('finance_type', self.get_default_type('default-finance-type')),
                         ('flow_type', self.get_default_type('default-flow-type')),
                         ('aid_type', self.get_default_type('default-aid-type')),
                         ('tied_status', self.get_default_type('default-tied-status'))])
        
        return defaults
    
    def convert(self, namespace):
        '''Converts the XML file into a RDFLib graph.
        
        Parameters
        @namespace: A RDFLib Namespace.
        
        Returns
        @graph: The RDFLib Graph of the activity.
        @id: The ID of the activity.'''
        
        if self.id == None:
            return None
        
        defaults = self.get_defaults()
        defaults['namespace'] = namespace
        
        converter = IatiElements(defaults)
        
        for attribute in self.xml:
            
            try:
                funcname = attribute.tag.replace("-","_"). replace("default_", "")
            
                update = getattr(converter, funcname)
                update(attribute)
                
            except AttributeError:
                print "Unknown element: " + funcname + ", in activity " + self.id
        
        return converter.get_result(), self.id
        
        