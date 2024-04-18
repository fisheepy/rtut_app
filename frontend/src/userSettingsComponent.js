import { React, useState } from 'react';
import { View, Text, Pressable, TextInput, Modal, Button, Alert } from 'react-native';
import { VscFeedback } from "react-icons/vsc";
import { GiConfirmed } from "react-icons/gi";
import { GiCancel } from "react-icons/gi";
import commonStyles from './styles/commonStyles';

import axios from 'axios';

const UserSettingsComponent = () => {
    const [expanded, setExpanded] = useState(false);
    const [name, setName] = useState('');
    const [feedback, setFeedback] = useState('');
    const [modalVisible, setModalVisible] = useState(false);

    const handleFeedbackSubmit = () => {
        // Replace with your backend endpoint
        const feedbackEndpoint = 'https://yourbackend.endpoint/feedback';

        axios.post(feedbackEndpoint, { feedback })
            .then((response) => {
                Alert.alert('Feedback Submitted', 'Thank you for your feedback!', [{ text: 'OK' }]);
                setName('');
                setFeedback('');
                setModalVisible(false);
            })
            .catch((error) => {
                Alert.alert('Error', 'Failed to submit feedback. Please try again.', [{ text: 'OK' }]);
                console.error('Feedback submission error:', error);
            });
    };

    const handleCloseModal = () => {
        setModalVisible(false);
    };

    return (
        <View style={commonStyles.useSetting.container}>
            <Pressable onPress={() => setExpanded(!expanded)}>
                <Text style={commonStyles.useSetting.toggleText}>{expanded ? 'Collapse' : 'User Settings'}</Text>
            </Pressable>

            {expanded && (
                <Pressable
                    style={commonStyles.useSetting.feedbackButton}
                    onPress={() => setModalVisible(true)}
                >
                    <VscFeedback />

                    <Text style={commonStyles.useSetting.linkText}>User Feedback</Text>

                </Pressable>
            )}
            <Modal
                animationType="slide"
                transparent={false}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(!modalVisible)}
            >
                <View style={commonStyles.useSetting.centeredView}>
                    <View style={commonStyles.useSetting.modalView}>
                        <TextInput
                            style={commonStyles.useSetting.nameInput}
                            onChangeText={setName}
                            value={name}
                            placeholder="Your Name"
                        />
                        <TextInput
                            style={commonStyles.useSetting.feedbackInput}
                            onChangeText={setFeedback}
                            value={feedback}
                            placeholder="Type your feedback here..."
                            multiline
                        />
                        <View style={commonStyles.useSetting.buttonGroup}>
                            <Pressable
                                style={commonStyles.useSetting.Button}
                                onPress={handleFeedbackSubmit}
                            >
                                <GiConfirmed
                                    style={commonStyles.useSetting.button}
                                    fontSize={40}
                                    color='green'
                                />
                            </Pressable>
                            <Pressable
                                style={commonStyles.useSetting.Button}
                                onPress={() => setModalVisible(!modalVisible)}
                            >
                                <GiCancel
                                    style={{ ...commonStyles.useSetting.button, pointerEvents: "none" }}
                                    fontSize={40}
                                />
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

export default UserSettingsComponent;