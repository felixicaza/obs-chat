import { useState, useEffect } from "react";
import useURLParams from "./useURLParams";
import useWebSocket, { ReadyState } from "react-use-websocket";
const CHANNEL = "chrisvdev"
const MSG_MAX_LENGTH = 150;
const MSG_AMOUNT = 6

function _getEmotes(emotes) {
    return emotes.split("/").map((emote) => {
        const [id, positions] = emote.split(":");
        const emoteToRender = { id, positions: [] };
        positions.split(",").forEach((position) => {
            const [begin, end] = position.split("-");
            emoteToRender.positions.push({ begin, end });
        });
        return emoteToRender;
    });
}

function _getTemplate(msg, rawEmotes) {
    const emotes = _getEmotes(rawEmotes);
    let sequence = [];
    const template = [];
    emotes.forEach((emote, i) =>
        emote.positions.forEach(({ begin, end }) =>
            sequence.push({ begin, end, emoteId: i })
        )
    );

    const _isAEmoji = (i) => {
        let result = -1;
        let index = 0;
        while (result < 0 && index < sequence.length) {
            if (i >= sequence[index].begin && i <= sequence[index].end)
                result = sequence[index].emoteId;
            index++;
        }
        return result;
    };
    for (let i = 0; i < msg.length; i++)
        _isAEmoji(i) < 0
            ? template.push(msg[i])
            : template.push(String.fromCharCode(1000 + _isAEmoji(i)));
    return template.join("");
};

function _renderEmoji(id) { return `<img class="mx-1 w-8 h-8 aspect-square object-cover" src="https://static-cdn.jtvnw.net/emoticons/v2/${id}/default/dark/2.0"/>` }

function _filterHTMLTags(msg) {
    return msg.replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
}

function _placeEmojis(msg, rawEmotes) {
    let toRender = _getTemplate(msg, rawEmotes);
    const emotes = _getEmotes(rawEmotes);
    const dot3 = toRender.length > MSG_MAX_LENGTH ? "..." : "";
    const toReplace = emotes.map(({ id, positions }, i) => {
        const length = positions[0].end - positions[0].begin + 1;
        return { id, pattern: String.fromCharCode(1000 + i).repeat(length) };
    });
    toRender = _filterHTMLTags(toRender)
        .substring(0, MSG_MAX_LENGTH);
    toReplace.forEach(
        ({ id, pattern }) =>
            (toRender = toRender.replaceAll(pattern, _renderEmoji(id)))
    );
    toReplace.forEach(
        (replace, i) =>
            (toRender = toRender.replaceAll(String.fromCharCode(1000 + i), ""))
    );
    return toRender + dot3;
};

export default function useTwitchChat() {
    const [messages, setMessages] = useState([])
    const [logged, setLogged] = useState(false);
    const params = useURLParams();
    const webSocket = useWebSocket(
        "ws://irc-ws.chat.twitch.tv:80",
        {
            share: true,
            shouldReconnect: () => true,
        }
    );
    const { sendMessage, lastMessage, readyState } = webSocket;
    const { access_token, client_id } = params;

    if (!access_token) {
        client_id && navigation.navigate(`https://id.twitch.tv/oauth2/authorize?response_type=token&client_id=${client_id}&redirect_uri=http://localhost:5173/&scope=chat%3Aread`)
    }

    useEffect(() => {
        if (
            params.access_token &&
            !logged &&
            readyState === ReadyState.OPEN
        ) {
            sendMessage(
                "CAP REQ :twitch.tv/membership twitch.tv/tags twitch.tv/commands"
            );
            sendMessage(`PASS oauth:${params.access_token}`);
            sendMessage("NICK ChrisVDev_OBS-Chat");
            sendMessage(`JOIN #${CHANNEL}`);
            setLogged(true);
        }
    }, [logged, webSocket]);

    useEffect(() => {
        if (readyState !== ReadyState.OPEN) setLogged(false);
    }, [readyState]);

    useEffect(() => {
        if (readyState === ReadyState.OPEN && logged) {
            const mkMsgObj = (rawMsg) => {
                const bomb = setTimeout(() => {
                    setMessages((previous) => previous.filter((msg) => msg.autoDestroy !== bomb))
                }, 15000)
                const [data, msg] = rawMsg.split(`PRIVMSG #${CHANNEL} :`)
                const objMsg = { autoDestroy: bomb, msg }
                data.split(";").map((element) => (objMsg[element.split('=')[0]] = element.split('=')[1]))
                return objMsg
            }
            lastMessage && lastMessage.data.includes("PRIVMSG") &&
                setMessages((previousCue) => [mkMsgObj(lastMessage.data), ...(previousCue.filter((e, i) => i < MSG_AMOUNT))])
            lastMessage && lastMessage.data.includes("PING") && sendMessage("PONG :tmi.twitch.tv")
        }
    }, [lastMessage])

    return {
        connectionStatus: {
            [ReadyState.CONNECTING]: "Connecting",
            [ReadyState.OPEN]: "Open",
            [ReadyState.CLOSING]: "Closing",
            [ReadyState.CLOSED]: "Closed",
            [ReadyState.UNINSTANTIATED]: "Uninstantiated",
        }[readyState],
        messageCue: messages.map((mssg) => {
            const { msg, emotes } = mssg
            const processed = structuredClone(mssg)
            processed.msg = emotes ? _placeEmojis(msg, emotes) : _filterHTMLTags(msg)
            return processed
        })
    }
}