import { useState, useEffect, useCallback } from 'react'
import useMessageLogic from './use_message_logic'

export default function useMessageCue() {
  const message = useMessageLogic()
  const [cue, setCue] = useState([])
  const [, setInter] = useState(0)
  const onRefresh = useCallback(
    (cue) =>
      cue.map((message) =>
        message.ttl === 0
          ? { ...message, new: false }
          : { ...message, dieing: true }
      ),
    []
  )
  /*  useEffect(() => { console.log(message) }, [message]) */
  useEffect(() => {
    message.msg &&
      setCue((lastCue) => [...lastCue, { ...message, ttl: 40, new: true }])
  }, [message])
  useEffect(() => {
    setInter(
      setInterval(() => {
        setCue((lastCue) =>
          onRefresh(
            lastCue
              .map((message) => ({ ...message, ttl: message.ttl - 1 }))
              .filter((message) => message.ttl > 0)
          )
        )
      }, 500)
    )
  }, [])
  return cue
}
