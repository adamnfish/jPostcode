/*
 * jPostcode.js
 *
 * @description: jQuery plugin to handle client-side adderss automcompletion from postcode using postcode anywhere
 * @author: Adam Fisher (adamnfish)
 * @version: 0.1 (alpha)
 * @licence: MIT-Style
 * @website: http://www.adamnfish.com/projects/jsonplate/
 * @github: http://github.com/adamnfish/jPostcode/tree
 * @requires: jQuery 1.3+
 *
 * ==================
 * *jPostcode includes components of*
 * Autocomplete - jQuery plugin 1.0.2
 *
 * Copyright (c) 2007 Dylan Verheul, Dan G. Switzer, Anjesh Tuladhar, JÃ¶rn Zaefferer
 *
 * Dual licensed under the MIT and GPL licenses:
 *   http://www.opensource.org/licenses/mit-license.php
 *   http://www.gnu.org/licenses/gpl.html
 *
 */

(function($){

	var KEY = {
		UP: 38,
		DOWN: 40,
		DEL: 46,
		TAB: 9,
		RETURN: 13,
		ESC: 27,
		COMMA: 188,
		PAGEUP: 33,
		PAGEDOWN: 34,
		BACKSPACE: 8
	};
	
	// empty function for callback defaults
	var empty = function(){};

	var jPostcode = function(field, opts){

		// default options for the plugin
		var defaults = {
			// select box defaults (for select plugin)
			scroll:			true,
			scrollHeight:	220,
			width:			254,
			resultsClass:	"ac_results",
			autoFill:		false,
			highlight: function(value){
				return value;
			},
			formatItem: function(data, i, value, term){
				return data[0];
			},
		
			// postcode defaults
			addressesUrl:	'',
			addressUrl:		'',
			errornode:		false,
			submitnode:		false,
			fieldMap: 		false, 
			errors: {
				noneFound:	"No addresses found.",
				empty:		"Please enter a postcode",
				invalid:	"Please enter a valid postcode",
				ajax:		"There was an error contacting the postcode lookup software"
			},
			postcodeFormat:	/[A-Z]{1,2}[0-9]{1,2}[A-Z]?\s*[0-9][ABDEFGHJLNPQRSTUWXYZ]{1,2}/i,
			addressKey:		"address",
			addressesKey:	"addresses",
			idKey:			"id",
			descriptionKey: "description", 
			// events / callbacks
			onAddresses:		empty,	// addresses found (ajax call complete)
			onAddress:			empty,	// address details found
			onSearch:			empty,	// loading addresses (ajax call commenced)
			onAddressFail:		empty,	// ajax call failed
			onAddressesFail:	empty,	// ajax call failed
			onLoading:			empty,	// called whenever the plugin is in a 'loading' state
			onLoaded:			empty,	// called when the plugin stops loading (fail or success)
			onPopulate:			empty,	// fired when population happens (when user selects an address)
			error:				empty	// optionally override the internal error function
		};
		
		// additional variables available in the plugin scope
		var	options 		= {},
			postcode		= "",
			select			= false,
			postcodeCache	= {},
			addressCache	= {},
			blurTimer		= false;
		
		// function references
		var	getAddresses,
			getAddress,
			selectAddress,
			reset,
			onSuccessAddresses,
			error,
			onSuccessAddress,
			populate,
			init;
			
	
		// init function is called when the document has loaded so the elements are available to JavaScript
		// creates elements and binds events
		init = function(id, opts) {
			// over-write default options with user-defined ones
			options = $.extend({}, defaults, opts);
			
			field = $(field)
				.attr("autocomplete", "off")
				.bind(($.browser.opera ? "keypress" : "keydown") + ".autocomplete", function(event) {
				// manages keyboard events on the field
				switch(event.keyCode) {
					case KEY.UP:
						if(select.visible()){
							select.prev();
							event.preventDefault();
						}
						break;

					case KEY.DOWN:
						if(select.visible()){
							select.next();
							event.preventDefault();
						} else{
							if(postcodeCache[$(field).val().toLowerCase()]){
								getAddresses();
							}
						}
						break;

					case KEY.PAGEUP:
						if(select.visible()){
							select.pageUp();
							event.preventDefault();
						}
						break;

					case KEY.PAGEDOWN:
						if(select.visible()){
							select.pageDown();
							event.preventDefault();
						}
						break;

					case KEY.RETURN:
						if(select.visible()){
							selectAddress();
						} else{
							getAddresses();
						}
						event.preventDefault();
						break;

					case KEY.TAB:
						if(select.visible()){
							selectAddress();
							event.preventDefault();
						}
						break;

					case KEY.ESC:
						select.hide();
						break;

					default:
						reset();
						break;
				}
			}).blur(function(){
				blurTimer = setTimeout(select.hide, 100);
			}).focus(function(){
				clearTimeout(blurTimer);
			});
			
			// override with error option
			if(empty !== options.error){
				error = options.error;
			}
			
			// create an error container if there isn't one specified
			if(!options.errornode){
				options.errornode = $("<label class='error' for='" + field.attr("id") + "'></label>");
				$(options.errornode).insertAfter(field);
			}
						
			// create a search button if it doesn't exist
			if(!options.submitnode){
				options.submitnode = $("<div id='find_address'><input type='button' value='Find Address' /></div>");
				$(options.submitnode).insertAfter(field).css('margin-left', '5px');
			}
			// bind search function to the buttons click handler
			options.submitnode.bind('click', function() {
				field.focus();
				getAddresses();
			});

			// create the select plugin instance
			select = $.Autocompleter.Select(options, field[0], selectAddress, {mouseDownOnSelect: false});
		};
		
		getAddresses = function() {
			// reset select box
			reset();
			// get postcode
			var value = field.val().toLowerCase().replace(/\s/g, "");
			if(value && value !== '') {
				// test postcode if a pattern is provided
				if(typeof(options.postcodeFormat.test) != "function" || options.postcodeFormat.test(value)){
					// read from the postcodeCache if an entry exists
					postcode = value;
					if(postcodeCache[postcode]){
						onSuccessAddresses(postcodeCache[postcode]);
					} else{
						options.onSearch();
						options.onLoading();
						$.ajax({
							url: options.addressesUrl + postcode,
							dataType: "json",
							success: onSuccessAddresses,
							error: function(){
								options.onAddressesFail(arguments);
								options.onLoaded();
								error(options.errors.ajax, field, options.errornode);
							}
						});
					}
				} else{
					error(options.errors.invalid, field, options.errornode);
				}
			} else {
				error(options.errors.empty, field, options.errornode);
			}
		};
		
		getAddress = function(pcaid) {
			if(addressCache[pcaid]){
				onSuccessAddress(addressCache[pcaid]);
			} else{
				options.onLoading();
				$.ajax({
					url: options.addressUrl + pcaid,
					dataType: "json",
					success: onSuccessAddress,
					error: function(){
						options.onAddressFail(arguments);
						options.onLoaded();
						error(options.errors.ajax, field, options.errornode);
					}
				});
			}
		};
		
		onSuccessAddresses = function(json) {
			options.onLoaded();
			options.onAddresses();
			if(json.error_number){
				error(json.message, field, options.errornode);
			} else if(!json || !json[options.addressesKey].length){
				error(options.errors.noneFound, field, options.errornode);
			} else{
				var addresslist = [];
				var addresses = json[options.addressesKey];
				$.each(addresses, function(i, a){
					addresslist.push({data: [a[options.descriptionKey], a[options.idKey]]});
				});
				// display the results
				select.display(addresslist, postcode);
				select.show();
				// postcodeCache the results
				postcodeCache[postcode] = json;
			}
		};
		
		onSuccessAddress = function(json) {
			options.onAddress();
			options.onLoaded();
			populate(json[options.addressKey][0]);
			if(json[options.addressKey][0][options.idKey]){
				addressCache[json[options.addressKey][0][options.idKey]] = json;
			}
		};
		
		selectAddress = function() {
		    var selected = select.selected();
		    if(selected && selected.data){
			    getAddress(selected.data[1]);
			    select.hide();
		    }
		};
				
		populate = function(json){
			options.onPopulate(json);
			// tries valiantly to populate form fields from the returned data
			if(typeof(options.fieldMap) == "function"){
				// if they've provided a function then let them handle the population
				options.fieldMap(json);
			} else{
				// else...
				jQuery.each(json, function(name, prop){
					if(options.fieldMap){
						// if they've provided mappings
						if(typeof(options.fieldMap) == "object" && typeof(options.fieldMap[name]) !== undefined){
							if(typeof(options.fieldMap[name]) == "function"){
								// if they've provided a callback fn for this field, then run it (expect it to do the val calculating, or return the mapped fieldname)
								name = options.fieldMap[name](name, prop, json);
							} else{
								// replace with mapped fieldname
								name = options.fieldMap[name] || name;
							}
						}
					}
					
					var target = $("[name=" + name + "]");
					if(target.length && (target.attr("tagName") == "INPUT" || target.attr("tagName") == "SELECT" || target.attr("tagName") == "TEXTAREA")){
						target.val(prop);
					}
				});
			}
		};
		
		reset = function(){
			select.hide();
			select.emptyList();
		};
		
		error = function(message, field, errornode){
			options.errornode.stop(true).text(message).show().fadeTo(50, 1, function(){
				options.errornode.fadeOut(2000);
			});
		};
	
		// everything is defined, call the init method when the document is ready (or immediately, more likely)
		$(document).ready(function(){
			init(field, opts);
		});

		return {
			hide: select.hide,
			clear: reset,
			error: error
		};
	};
	
	// add jPostcode to the jQuery element
	$.fn.extend({
		jPostcode: function(options){
			jPostcode(this, options);
			return this;
		}
	});
	
    /**
     * Select box plugin from autocompleter
     * this bit isn't required if you already have the jQuery autocompleter included in your site
     * (credit at top of file)
     */
	if(typeof($.Autocompleter) === "undefined"){
		$.Autocompleter = {};
	}
	$.Autocompleter.Select = function (options, input, select, config) {
		var CLASSES = {
			ACTIVE: "ac_over"
		};

		var listItems,
			active = -1,
			data,
			term = "",
			needsInit = true,
			element,
			list;

		// Create results
		function init() {
			if (!needsInit)
				return;
			element = $("<div/>")
			.hide()
			.addClass(options.resultsClass)
			.css("position", "absolute")
			.appendTo(document.body);

			list = $("<ul/>").appendTo(element).mouseover( function(event) {
				if(target(event).nodeName && target(event).nodeName.toUpperCase() == 'LI') {
		            active = $(list).children().removeClass(CLASSES.ACTIVE).index(target(event));
				    $(target(event)).addClass(CLASSES.ACTIVE);            
		        }
			}).click(function(event) {
				$(target(event)).addClass(CLASSES.ACTIVE);
				select();
				// TODO provide option to avoid setting focus again after selection? useful for cleanup-on-focus
				input.focus();
				return false;
			}).mousedown(function() {
				config.mouseDownOnSelect = true;
			}).mouseup(function() {
				config.mouseDownOnSelect = false;
			});

			if( options.width > 0 )
				element.css("width", options.width);

			needsInit = false;
		} 

		function target(event) {
			var element = event.target;
			while(element && element.tagName != "LI")
				element = element.parentNode;
			// more fun with IE, sometimes event.target is empty, just ignore it then
			if(!element)
				return [];
			return element;
		}

		function moveSelect(step) {
			listItems.slice(active, active + 1).removeClass(CLASSES.ACTIVE);
			movePosition(step);
	        var activeItem = listItems.slice(active, active + 1).addClass(CLASSES.ACTIVE);
	        if(options.scroll) {
	            var offset = 0;
	            listItems.slice(0, active).each(function() {
					offset += this.offsetHeight;
				});
	            if((offset + activeItem[0].offsetHeight - list.scrollTop()) > list[0].clientHeight) {
	                list.scrollTop(offset + activeItem[0].offsetHeight - list.innerHeight());
	            } else if(offset < list.scrollTop()) {
	                list.scrollTop(offset);
	            }
	        }
		}

		function movePosition(step) {
			active += step;
			if (active < 0) {
				active = listItems.size() - 1;
			} else if (active >= listItems.size()) {
				active = 0;
			}
		}

		function limitNumberOfItems(available) {
			return options.max && options.max < available
				? options.max
				: available;
		}

		function fillList() {
			list.empty();
			var max = limitNumberOfItems(data.length);
			for (var i=0; i < max; i++) {
				if (!data[i])
					continue;
				var formatted = options.formatItem(data[i].data, i+1, max, data[i].value, term);
				if ( formatted === false )
					continue;
				var li = $("<li/>").html( options.highlight(formatted, term) ).addClass(i%2 == 0 ? "ac_even" : "ac_odd").appendTo(list)[0];
				$.data(li, "ac_data", data[i]);
			}
			listItems = list.children();
			if ( options.selectFirst ) {
				listItems.slice(0, 1).addClass(CLASSES.ACTIVE);
				active = 0;
			}
			// apply bgiframe if available
			if ( $.fn.bgiframe )
				list.bgiframe();
		}

		return {
			display: function(d, q) {
				init();
				data = d;
				term = q;
				fillList();
			},
			next: function() {
				moveSelect(1);
			},
			prev: function() {
				moveSelect(-1);
			},
			pageUp: function() {
				if (active != 0 && active - 8 < 0) {
					moveSelect( -active );
				} else {
					moveSelect(-8);
				}
			},
			pageDown: function() {
				if (active != listItems.size() - 1 && active + 8 > listItems.size()) {
					moveSelect( listItems.size() - 1 - active );
				} else {
					moveSelect(8);
				}
			},
			hide: function() {
				element && element.hide();
				listItems && listItems.removeClass(CLASSES.ACTIVE);
				active = -1;
			},
			visible : function() {
				return element && element.is(":visible");
			},
			current: function() {
				return this.visible() && (listItems.filter("." + CLASSES.ACTIVE)[0] || options.selectFirst && listItems[0]);
			},
			show: function() {
				var offset = $(input).offset();
				element.css({
					width: typeof options.width == "string" || options.width > 0 ? options.width : $(input).width(),
					top: offset.top + input.offsetHeight,
					left: offset.left
				}).show();
	            if(options.scroll) {
	                list.scrollTop(0);
	                list.css({
						maxHeight: options.scrollHeight,
						overflow: 'auto'
					});

	                if($.browser.msie && typeof document.body.style.maxHeight === "undefined") {
						var listHeight = 0;
						listItems.each(function() {
							listHeight += this.offsetHeight;
						});
						var scrollbarsVisible = listHeight > options.scrollHeight;
	                    list.css('height', scrollbarsVisible ? options.scrollHeight : listHeight );
						if (!scrollbarsVisible) {
							// IE doesn't recalculate width when scrollbar disappears
							listItems.width( list.width() - parseInt(listItems.css("padding-left")) - parseInt(listItems.css("padding-right")) );
						}
	                }

	            }
			},
			selected: function() {
				var selected = listItems && listItems.filter("." + CLASSES.ACTIVE).removeClass(CLASSES.ACTIVE);
				return selected && selected.length && $.data(selected[0], "ac_data");
			},
			emptyList: function (){
				list && list.empty();
			},
			unbind: function() {
				element && element.remove();
			}
		};
	};
})(jQuery);
