const fs = require("fs");

require("dotenv").config();

const { Client, Intents, MessageEmbed } = require("discord.js");
const client = new Client({
	intents: [
		Intents.FLAGS.GUILDS,
		Intents.FLAGS.GUILD_MESSAGES,
		Intents.FLAGS.GUILD_VOICE_STATES
	]
});

let clientGuild : any = undefined;
let clientChannel : any = undefined;
let clientCommandAccessRole : any = undefined;

const clientGuildId = process.env.GUILD_ID;
const clientChannelId = process.env.CHANNEL_ID;
const clientCommandAccessRoleId = process.env.COMMAND_ACCESS_ROLE_ID;

class Event {
	type : any;
	uid : any;
	time : any;

	constructor(type : any, uid : any, time : any) {
		this.type = type;
		this.uid = uid;
		this.time = time;
	}
};

class Session {
	owner : any;
	channel : any;
	start : any;
	end : any;
	events : any;

	constructor(owner : any, channel : any) {
		this.owner = owner;
		this.channel = channel;
		this.start = new Date();
		this.end = undefined;
		this.events = [];
	}

	log(type : any, uid : any, time : any) {
		this.events[this.events.length] = new Event(type, uid, time);
	}
};
let sessions : any = [];
let maxSessionCount : any = 3;

client.on("ready", async () => {
	console.log(`>>> Logged in as ${client.user.tag}`);
	console.log(">>> Bonjour!");

	clientGuild = client.guilds.cache.get(clientGuildId);
	clientChannel = client.channels.cache.get(clientChannelId);
	clientCommandAccessRole = clientGuild.roles.cache.get(clientCommandAccessRoleId);
});

client.on("messageCreate", (msg : any) => {
	// console.log(`>>> Message from ${msg.author.tag}: ${msg.content}`);

	if (msg.channel !== clientChannel) return;
	if (!msg.member.roles.cache.has(clientCommandAccessRoleId)) return;

	if (msg.content.startsWith(".start")) {
		if (msg.content === ".start") {
			if (msg.member.voice.channelId === null) {
				console.log(`>>> Failed to start session: uid ${msg.author.id} is not in a voice chat channel!`);
				clientChannel.send(`UID <@${msg.author.id}> is not in a voice chat channel!`);
				return;
			}

			for (let i = 0; i < maxSessionCount; i++) {
				if (sessions[i] === undefined) {
					sessions[i] = new Session(msg.author.id, msg.member.voice.channelId);
					console.log(`>>> Session started by uid ${msg.author.id} in channel ${msg.member.voice.channelId}`);
					clientChannel.send(`Session started by <@${msg.author.id}> in <#${msg.member.voice.channelId}>`);
					break;
				} else {
					if (sessions[i].owner === msg.author.id) {
						console.log(`>>> Failed to start session: uid ${msg.author.id} already has a session in channel ${msg.member.voice.channelId}!`);
						clientChannel.send(`UID <@${msg.author.id}> already has a session in <#${msg.member.voice.channelId}>!`);
						break;
					}

					if (i == (maxSessionCount-1)) {
						console.log(`>>> Failed to start session: uid ${msg.author.id} failed to start a session, no free sessions left!`);
						clientChannel.send("Too many sessions!");
					}
				}
			}
		} else {
			let res : any = msg.content.match(/^.start <@![0-9]+>$/g);
			if ((res !== undefined) && (res !== null) && (res.length === 1) && (res[0] === msg.content)) {
				let tid : any = msg.content.match(/[0-9]+/g)[0];
				if (!msg.guild.members.cache.has(tid)) {
					console.log(`>>> Failed to start session: ${msg.author.id} tried to start a session for ${tid}, who isn't a server member!`);
					clientChannel.send(`UID <@${msg.author.id}> tried to start a session for UID <@${tid}>, who isn't a server member!`);
					return;
				}

				if (msg.guild.members.cache.get(tid).voice.channelId === null) {
					console.log(`>>> Failed to start session: UID <@${msg.author.id}> tried to start a session for UID <@${tid}> but they're not in a voice chat channel!`);
					clientChannel.send(`UID <@${msg.author.id}> tried to start a session for UID <@${tid}>, but they're not in a voice chat channel!`);
					return;
				}

				for (let i = 0; i < maxSessionCount; i++) {
					if (sessions[i] === undefined) {
						sessions[i] = new Session(tid, msg.guild.members.cache.get(tid).voice.channelId);
						console.log(`>>> Session started by uid ${msg.author.id} for uid ${msg.guild.members.cache.get(tid).id} in channel ${msg.guild.members.cache.get(tid).voice.channelId}`);
						clientChannel.send(`Session started by <@${msg.author.id}> for UID <@${msg.guild.members.cache.get(tid).id}> in <#${msg.guild.members.cache.get(tid).voice.channelId}>`);
						break;
					} else {
						if (sessions[i].owner === tid) {
							console.log(`>>> Failed to start session: uid ${tid} already has a session in channel ${sessions[i].channel}!`);
							clientChannel.send(`UID <@${tid}> already has a session in <#${sessions[i].channel}>!`);
							break;
						}

						if (i == (maxSessionCount-1)) {
							console.log(`>>> Failed to start session: uid ${tid} failed to start a session, no free sessions left!`);
							clientChannel.send("Too many sessions!");
						}
					}
				}
			}
		}
	} else if (msg.content.startsWith(".stop")) {
		if (msg.content === ".stop") {
			for (let i = 0; i < maxSessionCount; i++) {
				if (sessions[i] !== undefined) {
					if (sessions[i].owner === msg.author.id) {
						sessions[i].end = new Date();

						console.log(`>>> Session in ${sessions[i].channel} by ${sessions[i].owner} was stopped!`);
						clientChannel.send(`Session stopped by <@${sessions[i].owner}>`);

						const { formatDate, formatPeriod } = require("./util");

						let embed : any = new MessageEmbed()
							.setColor("#d548b0")
							.setTitle("Session Stats")
							.addFields(
								{ name: "Channel Name", value: `<#${sessions[i].channel}>` },
								{ name: "Start Time", value: formatDate(sessions[i].start, "verbose") },
								{ name: "End Time", value: formatDate(sessions[i].end, "verbose") },
								{ name: "Duration", value: formatPeriod(sessions[i].end.getTime() - sessions[i].start.getTime()) }
							);
						clientChannel.send({ embeds: [embed] });

						let str : any = "uid,type,time\n";
						for (let j = 0; j < sessions[i].events.length; j++) {
							str += `<@${sessions[i].events[j].uid}>,${sessions[i].events[j].type},${formatDate(sessions[i].events[j].time, "excel")}\n`;
						}

						let fname : any = `${new Date().toISOString()}.csv`;
						fs.writeFile(fname, str, (err : any) => {
							if (err) {
								console.log("Failed to write event log!");
								console.log(err);
								return;
							}

							clientChannel.send({ content: "Session event log:", files: [fname] });
						});

						sessions[i] = undefined;

						break;
					}
				}

				if (i === (maxSessionCount-1)) {
					console.log(`>>> UID ${msg.author.id} tried to stop a non-existent session`);
					clientChannel.send(`UID <@${msg.author.id}> has no running sessions!`);
				}
			}
		} else {
			let res : any = msg.content.match(/^.stop <@![0-9]+>$/g);
			if ((res !== undefined) && (res !== null) && (res.length === 1) && (res[0] === msg.content)) {
				let tid : any = msg.content.match(/[0-9]+/g)[0];
				if (!msg.guild.members.cache.has(tid)) {
					console.log(`>>> Failed to stop session: ${msg.author.id} tried to stop ${tid}'s session, who isn't a server member!`);
					clientChannel.send(`UID <@${msg.author.id}> tried to stop <@${tid}>'s session, who isn't a server member!`);
					return;
				}

				for (let i = 0; i < maxSessionCount; i++) {
					if (sessions[i] !== undefined) {
						if (sessions[i].owner === tid) {
							sessions[i].end = new Date();

							console.log(`>>> Session in ${sessions[i].channel} by ${sessions[i].owner} was stopped by ${msg.author.id}!`);
							clientChannel.send(`<@${sessions[i].owner}>'s session was stopped by <@${msg.author.id}>!`);

							const { formatDate, formatPeriod } = require("./util");

							let embed : any = new MessageEmbed()
								.setColor("#d548b0")
								.setTitle("Session Stats")
								.addFields(
									{ name: "Channel Name", value: `<#${sessions[i].channel}>` },
									{ name: "Start Time", value: formatDate(sessions[i].start, "verbose") },
									{ name: "End Time", value: formatDate(sessions[i].end, "verbose") },
									{ name: "Duration", value: formatPeriod(sessions[i].end.getTime() - sessions[i].start.getTime()) }
								);
							clientChannel.send({ embeds: [embed] });

							let str = "uid,type,time\n";
							for (let j = 0; j < sessions[i].events.length; j++) {
								str += `<@${sessions[i].events[j].uid}>,${sessions[i].events[j].type},${formatDate(sessions[i].events[j].time, "excel")}\n`;
							}

							let fname = `${new Date().toISOString()}.csv`;
							fs.writeFile(fname, str, (err : any) => {
								if (err) {
									console.log("Failed to write event log!");
									console.log(err);
									return;
								}

								clientChannel.send({ content: "Session event log:", files: [fname] });
							});

							sessions[i] = undefined;

							break;
						}
					}

					if (i === (maxSessionCount-1)) {
						console.log(`>>> Failed to stop session: ${msg.author.id} tried to stop ${tid}'s non-existent session!`);
						clientChannel.send(`UID <@${msg.author.id}> tried to stop <@${tid}>'s non-existent session!`);
					}
				}
			}
		}
	} else if (msg.content.startsWith(".sessions")) {
		if (msg.content === ".sessions") {
			let str : any = "[\n";
			for (let i = 0; i < maxSessionCount; i++) {
				str += "{\n";

				if (sessions[i] !== undefined) {
					str += `"owner": "${sessions[i].owner}",\n`
					str += `"channel": "${sessions[i].channel}",\n`;
					str += `"start": "${sessions[i].start.toISOString()}",\n`;
					str += `"end": "${(sessions[i].end === undefined) ? "undefined" : sessions[i].end.toISOString()}",\n`;
					str += "\"events\": [\n";
					for (let j = 0; j < sessions[i].events.length; j++) {
						str += "{\n";
						str += `"type": "${sessions[i].events[j].type}",\n`;
						str += `"uid": "${sessions[i].events[j].uid}",\n`;
						str += `"time": "${sessions[i].events[j].time}"\n`;
						str += "},\n";
					}
					str += "]\n";
				}

				str += "},\n";
			}
			str += "]\n";
			clientChannel.send(str);
		}
	} else if (msg.content.startsWith(".help")) {
		if (msg.content === ".help") {
			console.log(`UID ${msg.author.id} requested help info!`);

			let str : any = "These are the available commands:\n";
			str += ".start [@user] - Start a session for yourself or someone else\n";
			str += ".stop [@user] - Stops a session for yourself or someone else\n";
			str += ".sessions - Lists information about current sessions\n";
			str += ".setMaxSession {count} - Sets the maximum amount of simulataneous sessions";
			str += ".help - Lists the available commands\n";
			clientChannel.send(str);
		}
	} else if (msg.content.startsWith(".setMaxSessions")) {
		let res = msg.content.match(/^.setMaxSessions [0-9]+$/g);
		if ((res !== undefined) && (res !== null) && (res.length === 1) && (res[0] === msg.content)) {
			let oldval = maxSessionCount;
			let newval = Math.floor(msg.content.match(/(-?|\+?)\d+/g)[0]);

			if (newval >= 0) {
				maxSessionCount = newval;
				console.log(`>>> Set maxSessionCount to ${newval} (was previously ${oldval})!`);
				clientChannel.send(`Set maxSessionCount to ${newval} (was previously ${oldval})!`);
			} else {
				console.log(`>>> Failed to set maxSessionCount to ${newval}, value cannot be negative!`);
				clientChannel.send(`Failed to set maxSessionCount to ${newval}, value cannot be negative!`);
			}
		}
	}
});

client.on("voiceStateUpdate", (oldState : any, newState : any) => {
	let person : any = newState.id;
	let oldChannel : any = oldState.channelId;
	let newChannel : any = newState.channelId;
	let time : any = new Date();

	if ((oldChannel === null) && (newChannel !== null)) {
		//console.log(`uid ${person} joined channel ${newChannel} on ${stamp}`);
		//clientChannel.send(`uid <@${person}> joined channel <#${newChannel}> on ${stamp}`);

		for (let i = 0; i < maxSessionCount; i++) {
			if (sessions[i] !== undefined) {
				if (sessions[i].channel === newChannel) {
					//if (sessions[i].owner !== person) {
						sessions[i].log("join", person, time);
					//}
				}
			}
		}
	} else if ((oldChannel !== null) && (newChannel === null)) {
		//console.log(`uid ${person} left channel ${oldChannel} on ${stamp}`);
		//clientChannel.send(`uid <@${person}> left channel <#${oldChannel}> on ${stamp}`);

		for (let i = 0; i < maxSessionCount; i++) {
			if (sessions[i] !== undefined) {
				if (sessions[i].channel === oldChannel) {
					//if (sessions[i].owner !== person) {
						sessions[i].log("leave", person, time);
					//}
				}
			}
		}
	} else if ((oldChannel !== null) && (newChannel !== null)) {
		//console.log(`uid ${person} moved from ${oldChannel} to ${newChannel} on ${stamp}`);
		//clientChannel.send(`uid <@${person}> moved from <#${oldChannel}> to <#${newChannel}> on ${stamp}`);

		for (let i = 0; i < maxSessionCount; i++) {
			if (sessions[i] !== undefined) {
				if (sessions[i].channel === oldChannel) {
					//if (sessions[i].owner !== person) {
						sessions[i].log("leave", person, time);
					//}
				}

				if (sessions[i].channel === newChannel) {
					//if (sessions[i].owner !== person) {
						sessions[i].log("join", person, time);
					//}
				}
			}
		}
	}
});

client.login(process.env.TOKEN);