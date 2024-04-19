import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { formatTimeString } from './utils';
import commonStyles from './styles/commonStyles';

const MessageViewComponent = ({ notification, onPress }) => {
    const isRead = notification.read; // Assuming notification has a 'read' field to indicate its read status

    return (
        <Pressable onPress={onPress}>
            <View style={commonStyles.messageView.container}>
                <View style={commonStyles.messageView.headLine}>
                    <View style={[commonStyles.messageView.indicator, isRead ? commonStyles.messageView.readIndicator : commonStyles.messageView.unreadIndicator]} />
                    <Text style={commonStyles.messageView.sender}>From: {notification.payload.sender}</Text>
                    <Text style={commonStyles.messageView.time}>{formatTimeString(notification.createdAt)}</Text>
                </View>
                <View style={commonStyles.messageView.subjectLine}>
                    <Text style={commonStyles.messageView.subject}>
                        {notification.payload.subject || notification.payload.messageType}
                    </Text>
                </View>
            </View>
        </Pressable>
    );
};

export default MessageViewComponent;
