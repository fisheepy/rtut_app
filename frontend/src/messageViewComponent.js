import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { formatTimeString } from './utils';
import commonStyles from './styles/commonStyles';

const MessageViewComponent = ({ notification, onPress }) => {
    const isRead = notification.read; // Assuming notification has a 'read' field to indicate its read status

    return (
        <Pressable onPress={onPress}>
            <View style={[commonStyles.messageView.container, isRead ? commonStyles.messageView.readContainer : commonStyles.messageView.unreadContainer]}>
                <View>
                    <Text style={[commonStyles.messageView.subject, isRead ? commonStyles.messageView.readSubject : commonStyles.messageView.unreadSubject]}>
                        {notification.payload.subject || notification.payload.messageType}
                    </Text>
                </View>
                <View style = {commonStyles.messageView.infoContainer}>
                    <Text style={commonStyles.messageView.sender}>From: {notification.payload.sender}</Text>
                    <Text style={commonStyles.messageView.time}>{formatTimeString(notification.createdAt)}</Text>
                </View>
            </View>
        </Pressable>
    );
};

export default MessageViewComponent;
