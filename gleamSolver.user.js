// ==UserScript==
// @name Gleam.solver
// @namespace https://github.com/Citrinate/gleamSolver
// @description Auto-completes Gleam.io contest entries
// @author Citrinate
// @version 1.3.0
// @match *://gleam.io/*
// @match https://steamcommunity.com/app/329630
// @updateURL https://raw.githubusercontent.com/Citrinate/gleamSolver/master/gleamSolver.user.js
// @downloadURL https://raw.githubusercontent.com/Citrinate/gleamSolver/master/gleamSolver.user.js
// @require https://raw.githubusercontent.com/Citrinate/gleamSolver/master/lib/randexp.min.js
// @run-at document-end
// ==/UserScript==

(function() {
	// command_hub_url is the only page on steamcommunity that this script will be injected at (as referenced in @match above)
	// it can be any page on steamcommunity.com that can be loaded into an iframe
	var command_hub_url = "https://steamcommunity.com/app/329630",
		current_version = "1.3.0";

	var gleamSolver = (function() {
		var gleam = null,
			steam_handler = null,
			script_mode = null,
			authentications = {};

		// possible modes:
		// "undo_all" (Instant-win mode): There should be no record of any social media activity on the user's accounts
		// "undo_none (Raffle mode): All record of social media activity should remain on the user's accounts
		// "undo_some" (Not presently used): Mark all entries and remove all possible record of social media activity on the user's accounts
		function determineMode() {
			switch(gleam.campaign.campaign_type) {
				case "Reward": return "undo_all"; // Instant-win
				case "Competition": return "undo_none";	// Raffle
				default: return "undo_all";
			}
		}

		// check to see what accounts the user has linked to gleam
		function checkAuthentications() {
			if(gleam.contestantState.contestant.authentications) {
				var authentication_data = gleam.contestantState.contestant.authentications;

				for(var i = 0; i < authentication_data.length; i++) {
					var current_authentication = authentication_data[i];
					authentications[current_authentication.provider] = !current_authentication.expired;
				}
			}
		}

		// decide what to do for each of the entries
		function handleEntries() {
			var entries = jQuery(".entry-method");

			for(var i = 0; i < entries.length; i++) {
				var current_entry = angular.element(entries[i]).scope();
				
				if(gleam.canEnter(current_entry.entry_method) &&
					(!current_entry.entry_method.requires_authentication || authentications[current_entry.entry_method.provider] === true)
				) {
					//TODO: add more entry types
					try {
						switch(current_entry.entry_method.entry_type) {
							case "download_app":
							case "facebook_enter":
							case "facebook_visit":
							case "googleplus_visit":
							case "instagram_enter":
							case "steam_enter":
							case "steam_play_game":
							case "twitchtv_enter":
							case "twitchtv_subscribe":
							case "twitter_enter":
							case "youtube_subscribe":
								handleClickEntry(current_entry);
								break;

							case "youtube_watch":
							case "vimeo_watch":
								handleVideoEntry(current_entry);
								break;

							case "steam_join_group":
								if(steam_handler === null) steam_handler = loadSteamHandler.getInstance();
								steam_handler.handleEntry(current_entry);
								break;

							default:
								break;
						}

						// for the following entries it's not possible to automate without potentially
						// being disqualified in a gleam raffle.  only handle these if the user doesn't care
						// about the status of the entry after this script completes: such as in the case of
						// gleam instant-win giveaways
						if(script_mode != "undo_none") {
							switch(current_entry.entry_method.entry_type) {
								case "pinterest_board":
								case "pinterest_follow":
								case "pinterest_pin":
								case "youtube_comment":
								case "youtube_video":
								case "twitter_hashtags":
									handleQuestionEntry(current_entry);
									break;

								// custom actions can take a bunch of different forms
								case "custom_action":
									if(current_entry.entry_method.template != "visit" && (
											current_entry.entry_method.method_type == "Ask a question" ||
											current_entry.entry_method.method_type == "Allow question or tracking" ||
											current_entry.entry_method.config5 ||
											current_entry.entry_method.config6
										)
									) {
										if(current_entry.entry_method.config5 !== null) {
											handleMultipleChoiceQuestionEntry(current_entry);
										} else {
											handleQuestionEntry(current_entry);
										}
									} else {
										handleClickEntry(current_entry);
									}
									break;

								default:
									break;
							}
						}

						// the following entry types cannot presently be undone, and so only automate
						// them if the user doesn't want social media actions to be undone: such as in the 
						// case of gleam raffles
						if(script_mode != "undo_all") {
							switch(current_entry.entry_method.entry_type) {
								case "email_subscribe":
								case "eventbrite_attend_event":
								case "eventbrite_attend_venue":
								case "instagram_follow":
								case "instagram_like":
								case "soundcloud_follow":
								case "soundcloud_like":
								case "tumblr_follow":
								case "tumblr_like":
								case "tumblr_reblog":
								case "tumblr_reblog_campaign":
								case "twitchtv_follow":
								case "twitter_follow":
								case "twitter_retweet":
								case "twitter_tweet":
									handleClickEntry(current_entry);
									break;

								//case "facebook_media": this entry type seems to be bugged
								case "instagram_choose":
								case "twitter_media":
									handleMediaShare(current_entry);
									break;

								default:
									break;
							}
						}
					}
					catch(e) {
						console.log(e);
					}
				}
			}
				
			// hide any entry submission forms that may be open
			gleam.hideEntryMethodAndShowPopover(gleam.entry_methods);
		}

		// finish up an entry
		function markEntryCompleted(entry, callback) {
			entry.entry_method.entering = false;
			entry.enterLinkClick(entry.entry_method);
			entry.verifyEntryMethod();

			// callback after gleam marks the entry as completed
			if(typeof(callback) == "function") {
				var temp_interval = setInterval(function() {
					if(!gleam.canEnter(entry.entry_method)) {
						clearInterval(temp_interval);
						callback();
					}
				}, 500);
			}
		}

		// provide visual feedback to the user that something is happening
		function markEntryLoading(entry) {
			entry.entry_method.entering = true;
		}

		// trick gleam into thinking we've clicked a link
		function handleClickEntry(entry) {
			markEntryLoading(entry);
			entry.triggerVisit(entry.entry_method.id);
			markEntryCompleted(entry);
		}

		// trick gleam into thinking we've watched a video
		function handleVideoEntry(entry) {
			markEntryLoading(entry);
			entry.entry_method.watched = true;
			entry.videoWatched(entry.entry_method);
			markEntryCompleted(entry);
		}

		// choose an answer to a multiple choice question
		function handleMultipleChoiceQuestionEntry(entry) {
			var choices = entry.entry_method.config5.split("\n"),
				rand_choice = choices[Math.floor(Math.random() * choices.length)];

			markEntryLoading(entry);

			//TODO: there's probably more templates that I'm missing here
			switch(entry.entry_method.template) {
				case "choose_image":
					entry.imageChoice(entry.entry_method, rand_choice);
					entry.imageChoiceContinue(entry.entry_method);
					break;

				case "choose_option":
					entry.entryState.formData[entry.entry_method.id] = rand_choice;
					entry.saveEntryDetails(entry.entry_method);
					break;

				case "multiple_choice":
					entry.entryState.formData[entry.entry_method.id][rand_choice] = true;
					entry.saveEntryDetails(entry.entry_method);
					break;

				default:
					break;
			}

			markEntryCompleted(entry);
		}

		// generate an answer for question entries
		function handleQuestionEntry(entry) {
			var rand_string = null,
				string_regex = null;
			
			if(entry.entry_method.entry_type == "youtube_video") {
				// asks for a youtube video link, and actually verifies that it's real
				rand_string = "https://www.youtube.com/watch?v=oHg5SJYRHA0";
			} else {
				if(entry.entry_method.entry_type == "twitter_hashtags") {
					// gleam wants a link to a tweet here, but doesn't actually check the link
					string_regex = "https://twitter\\.com/[a-zA-Z]{5,15}/status/[0-9]{18}/";
				} else {
					// config6 is either "" or null for anything is accepted, or a regex that the answer is checked against (validated server-side)
					string_regex = (entry.entry_method.config6 === "" || entry.entry_method.config6 === null) ? "\\.+" : entry.entry_method.config6;
				}
					
				// generate a random matching string
				var rand_string_generator = new RandExp(string_regex);
				rand_string_generator.tokens.stack[0].max = 1; // prevent long strings
				rand_string = rand_string_generator.gen();
			}

			markEntryLoading(entry);
			// submit the answer
			entry.entryState.formData[entry.entry_method.id] = rand_string;
			entry.verifiedValueChanged(entry.entry_method);
			
			// wait until the answer is verified
			var temp_interval = setInterval(function() {
				if(entry.verifyStatus(entry.entry_method) == "good") {
					clearInterval(temp_interval);
					entry.saveEntryDetails(entry.entry_method);
					markEntryCompleted(entry);
				}
			}, 500);
		}
		
		// share a random media from the selection provided
		function handleMediaShare(entry) {
			// need to click the entry before media is defined
			entry.enterLinkClick(entry.entry_method);
			markEntryLoading(entry);
			
			// and then wait
			var temp_interval = setInterval(function() {
				if(entry.entry_method.media) {
					var choices = entry.entry_method.media,
						rand_choice = choices[Math.floor(Math.random() * choices.length)];
						
					clearInterval(temp_interval);
					entry.entry_method.selected = rand_choice;
					entry.mediaChoiceContinue(entry.entry_method);
					markEntryCompleted(entry);
				}
			}, 500);
		}

		// handles steam_join_group entries
		var loadSteamHandler = (function() {
			function init() {
				// Need some way to communicate with steamcommunity.com that is preferrably transparent
				// to the user.  command_hub is simply a page on steamcommunity.com that can be loaded
				// into an iframe.  We can communicate with the iframe from here and use it as our
				// interface to joining and leaving Steam groups.
				var command_hub = document.createElement('iframe');
				
				command_hub.style.display = "none";
				command_hub.src = command_hub_url;
				document.body.appendChild(command_hub);

				function handleGroup(entry, group_name, group_id) {
					// wait for the command hub to load
					command_hub.addEventListener("load", function() {
						// make contact with the command hub
						command_hub.contentWindow.postMessage({action: "join", name: group_name, id: group_id}, "*");

						// wait for a response
						window.addEventListener("message", function(event) {
							if(event.source == command_hub.contentWindow && event.data.status == "not_logged_in") {
								// we're not logged in, try to mark it anyway incase we're already a member of the group
								markEntryCompleted(entry);
								gleamSolverUI.showError("You must be logged into steamcommunity.com");
							} else if(event.source == command_hub.contentWindow && event.data.id == group_id) {
								if(event.data.status == "already_joined") {
									// user was already a member, don't even consider leaving
									markEntryCompleted(entry);
								} else if(event.data.status == "joined") {
									markEntryCompleted(entry, function() {
										if(script_mode != "undo_none") {
											// depending on mode, leave the group
											command_hub.contentWindow.postMessage({action: "leave", name: group_name, id: group_id}, "*");
										}
									});
								}
							}
						}, false);
					});
				}

				return {
					handleEntry: function(entry) {
						markEntryLoading(entry);
						handleGroup(entry, entry.entry_method.config3, entry.entry_method.config4);
					}
				};
			}

			var instance;
			return {
				getInstance: function() {
					if(!instance) instance = init();
					return instance;
				}
			};
		})();

		return {
			initGleam: function() {
				// wait for gleam to finish loading
				temp_interval = setInterval(function() {
					if(jQuery(".popup-blocks-container") !== null) {
						clearInterval(temp_interval);
						gleam = angular.element(jQuery(".popup-blocks-container")).scope();
						script_mode = determineMode();
						checkAuthentications();

						// reveal hidden entries
						for(var i = 0; i < gleam.entry_methods.length; i++) {
							gleam.entry_methods[i].mandatory = true;
						}

						gleamSolverUI.loadUI();
					}
				}, 500);
			},

			completeEntries: function() {
				handleEntries();
			}
		};
	})();

	var gleamSolverUI = (function() {
		var active_errors = [],
		    button_class = "btn btn-embossed btn-info",
		    button_style = { margin: "2px 0px 2px 16px" },
		    container_style = { 
				background: "#000",
				color: "#3498db",
				"box-shadow": "-10px 2px 10px #000",
				padding: "8px",
				"font-size": "18px",
				width: "100%",
				position: "fixed",
				top: "0px",
				left: "0px",
				"z-index": 9999999999 
			},
			error_style = jQuery.extend({}, container_style, { background: "#e74c3c", color: "#fff", "box-shadow": "-10px 2px 10px #e74c3c" }),
			gleam_solver_errors = jQuery("<div>", { css: error_style }),
			gleam_solver_ui = 
				jQuery("<div>", { css: container_style }).append(
					jQuery("<span>", { text: "Gleam.solver v" + current_version })).append(
					jQuery("<a>", { text: "Click here to auto-complete", class: button_class, css: button_style}).click(function() {
						jQuery(this).unbind("click");
						gleam_solver_ui.slideUp();
						jQuery("html").css("margin-top", 0);
						gleamSolver.completeEntries();
					})
				);

		return {
			loadUI: function() {
				jQuery("body").prepend(gleam_solver_ui);
				jQuery("html").css("overflow-y", "scroll");
				jQuery("html").css("margin-top", gleam_solver_ui.outerHeight());
			},

			showError: function(msg) {
				if(active_errors.indexOf(msg) == -1) {
					if(active_errors.length === 0) {
						jQuery("body").append(gleam_solver_errors);
					}

					gleam_solver_errors.append(jQuery("<div>", { text: "Gleam.solver Error: " + msg }));
					jQuery("html").css("margin-top", gleam_solver_errors.outerHeight());
					active_errors.push(msg);
				}
			}
		};
	})();

	// does the actual steam group joining/leaving
	function initSteamCommandHub() {
		var active_groups = null,
			logged_in = g_steamID !== false;

		if(logged_in) {
			// make note of what groups we're already a member of, so that we don't leave any of them
			jQuery.ajax({
				url: "https://steamcommunity.com/my/groups",
				async: false,
				complete: function(data) {
					if(data.responseText.toLowerCase().indexOf("you belong to 0 groups") != -1) {
						// user isn't a member of any steam groups
						active_groups = [];
					} else {
						jQuery(data.responseText).find(".groupBlock a.linkTitle").each(function() {
							var group_name = jQuery(this).attr("href").replace("https://steamcommunity.com/groups/", "");
							if(active_groups === null) active_groups = [];
							active_groups.push(group_name);
						});
					}
				}
			});
		}

		// wait for our parent to tell us what to do
		window.addEventListener("message", function(event) {
			if(event.source == parent && event.origin == "https://gleam.io") {
				if(!logged_in) {
					parent.postMessage({status: "not_logged_in"}, "*");
				} else if(active_groups !== null) {
					if(event.data.action == "join") {
						joinGroup(event.data.name, event.data.id);
					} else if(event.data.action == "leave") {
						leaveGroup(event.data.name, event.data.id);
					}
				}
			}
		}, false);

		function joinGroup(group_name, group_id) {
			if(active_groups.indexOf(group_name) != -1) {
				// already a member
				parent.postMessage({status: "already_joined", name: group_name, id: group_id}, "*");
			} else {
				jQuery.ajax({
					url: "https://steamcommunity.com/groups/" + group_name,
					type: "POST",
					data: {action: "join", sessionID: g_sessionID},
					complete: function() {
						parent.postMessage({status: "joined", name: group_name, id: group_id}, "*");
					}
				});
			}
		}

		function leaveGroup(group_name, group_id) {
			// never leave a group that the user was already a member of
			if(active_groups.indexOf(group_name) == -1) {
				// no real need to let the gleamSolver know we left the group
				jQuery.ajax({
					url: jQuery(".playerAvatar a").attr("href").replace("http://", "https://") + "home_process",
					type: "POST",
					data: {sessionID: g_sessionID, action: "leaveGroup", groupId: group_id}
				});
			}
		}
	}

	// determine where we are and call the appropriate function
	if(document.location.hostname == "gleam.io") {
		gleamSolver.initGleam();
	} else if(document.location == command_hub_url) {
		initSteamCommandHub();
	}
})();