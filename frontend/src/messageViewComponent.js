import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { formatTimeString } from './utils';
import commonStyles from './styles/commonStyles';

const MessageViewComponent = ({ notification, onPress, isSurveyCompleted }) => {
    const isRead = notification.read;
    const isSurvey = notification.payload.messageType === 'SURVEY';

    const indicatorStyle = isSurvey
        ? (isSurveyCompleted ? commonStyles.messageView.readIndicator : commonStyles.messageView.unreadIndicator)
        : (isRead ? commonStyles.messageView.readIndicator : commonStyles.messageView.unreadIndicator);
        
    return (
        <Pressable onPress={onPress}>
            <View style={commonStyles.messageView.container}>
                <View style={commonStyles.messageView.headLine}>
                    <View style={[commonStyles.messageView.indicator, indicatorStyle]} />
                    <Text style={commonStyles.messageView.sender}>{notification.payload.sender}</Text>
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
