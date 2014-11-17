(function(){
"use strict";
/**
*	json2xml
*
*	converts JSON object to XML string
*	Warning: operates in O(n^2)
*	
*	keys that start with _ will be added to tag attributes
*	keys written in camelCase will be hyphenated i.e camel-case
*/

/**
*	ccFilter
*
*	converts camelCase to hyphenated i.e camel-case
*	@param	{string}	input	string to be converted
*	@return	{string}				hyphenated string
*/
function ccFilter(input){
	var regex = /([A-Z])/g;
	input.replace(regex, function(string, match){
		return "-"+match.toLowerCase();
	});
	//TODO: convert to hypenated ~30 min
	return input;
}

/**
*	attScan
*
*	scans object for attributes
*	@param	{object}	obj		object to be scaned
*	@param	{string}	ent		name of object
*	@return	{string}				xml open tag
*/	
function attScan(obj, ent){
	var returnString = "<"+ccFilter(ent);
	var att;
	
	for(att in obj){
		//type check
		if(obj.hasOwnProperty(att)){
			if(att.charAt(0) === "_"){
				//append to open tag;
				returnString += " "+att.slice(1)+"=\""+obj[att]+"\"";
			}
		}
	}
	
	returnString += ">";
	return returnString;
}
/**
*	parseJSONHelper
*
*	parses JSON objecct, recursion helper
*	@param	{object} jsonObj	JSON object to be parsed
*	@return	{string}					XML output
*/
function parseJsonHelper(obj){
	var xml = '';
	if(obj){//check null
		if(typeof obj !== 'object'){
			//primitive
			xml = obj;
		}else{
			var ent;
			//object
			for(ent in obj){
				if(typeof obj[ent] !== "function"){ //avoid objects in the prototype
					//TODO: array handling so that att name is not a number
					var open = attScan(obj[ent], ent); 
					var close = "</"+ent +">";
					//filter att format
					if(ent.charAt(0) !== "_"){
						xml += open+parseJsonHelper(obj[ent])+close;
					}
				}
			}
		}
	}
	return xml;
}

/**
*	parseJSON
*	Warning
*		- blocking operation
*	parses JSON objecct
*	@param	{object}	jsonObj		JSON object to be parsed
*	@param	{boolean}	hyp 		if tag names should be converted to camle case
*	@param	{string|boolean}	tagName		name of xml parent node, xml if undefined, no parent node if false
*	@return	{string}					XML output
*/
function parseJson(json, tagName){
	var xml = '';
	if(tagName === false){//boolean false
		//no parent node
		return parseJsonHelper(json); 
	}
	parent = tagName || "xml";
	return xml += "<"+parent+">"+parseJsonHelper(json)+"</"+parent+">";
}
module.export = parseJson;
})();