import React, { useState } from 'react'
import { View, TextInput, Text, TouchableOpacity, SafeAreaView } from 'react-native'
import { NativeStackScreenProps } from '@react-navigation/native-stack'

type Props = NativeStackScreenProps<any, 'JoinRoom'>

export default function JoinRoom({ navigation }: Props) {
  const [room, setRoom] = useState('')
  const [user, setUser] = useState('')

  const handleJoin = () => {
    if (!room || !user) return
    navigation.navigate('ChatRoom', { room, user })
  }

  return (
    <SafeAreaView className="flex-1 justify-center p-4 bg-white">
      <View className="space-y-4">
        <TextInput
          placeholder="Your name"
          value={user}
          onChangeText={setUser}
          className="border p-2 rounded"
        />
        <TextInput
          placeholder="Room ID"
          value={room}
          onChangeText={setRoom}
          className="border p-2 rounded"
        />
        <TouchableOpacity onPress={handleJoin} className="bg-blue-500 p-3 rounded">
          <Text className="text-white text-center">Join Room</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}
