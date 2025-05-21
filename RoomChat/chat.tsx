import React, { useEffect, useRef, useState } from 'react'
import { SafeAreaView, TextInput, FlatList, Text, TouchableOpacity, View } from 'react-native'
import { NativeStackScreenProps } from '@react-navigation/native-stack'
import socket from '../socket'

type Props = NativeStackScreenProps<any, 'ChatRoom'>

export default function ChatRoom({ route }: Props) {
  const { room, user } = route.params
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<{ user: string; text: string }[]>([])
  const flatListRef = useRef<FlatList>(null)

  useEffect(() => {
    socket.emit('join', { room, user })

    socket.on('message', (msg) => {
      setMessages((prev) => [...prev, msg])
    })

    return () => {
      socket.off('message')
    }
  }, [])

  const sendMessage = () => {
    if (!message) return
    socket.emit('message', { room, user, text: message })
    setMessage('')
  }

  return (
    <SafeAreaView className="flex-1 bg-white p-4">
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(_, i) => i.toString()}
        renderItem={({ item }) => (
          <View className="mb-2">
            <Text className="font-bold">{item.user}</Text>
            <Text>{item.text}</Text>
          </View>
        )}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />
      <View className="flex-row items-center mt-4">
        <TextInput
          placeholder="Message"
          value={message}
          onChangeText={setMessage}
          className="border flex-1 p-2 rounded"
        />
        <TouchableOpacity onPress={sendMessage} className="ml-2 bg-green-500 p-3 rounded">
          <Text className="text-white">Send</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}
