import { React, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Modal, Button, Alert } from 'react-native';
import axios from 'axios';

const UserSettingsComponent = () => {
    const [expanded, setExpanded] = useState(false);
    const [feedback, setFeedback] = useState('');
    const [modalVisible, setModalVisible] = useState(false);

    const handleFeedbackSubmit = () => {
        // Replace with your backend endpoint
        const feedbackEndpoint = 'https://yourbackend.endpoint/feedback';

        axios.post(feedbackEndpoint, { feedback })
            .then((response) => {
                Alert.alert('Feedback Submitted', 'Thank you for your feedback!', [{ text: 'OK' }]);
                setFeedback('');
                setModalVisible(false);
            })
            .catch((error) => {
                Alert.alert('Error', 'Failed to submit feedback. Please try again.', [{ text: 'OK' }]);
                console.error('Feedback submission error:', error);
            });
    };

    return (
        <View style={styles.container}>
            <Pressable onPress={() => setExpanded(!expanded)}>
                <Text style={styles.toggleText}>{expanded ? 'Collapse' : 'User Settings'}</Text>
            </Pressable>

            {expanded && (
                <Pressable
                    style={styles.feedbackButton}
                    onPress={() => setModalVisible(true)}
                >
                    {/* Use Icon component here, e.g., <Icon name="feedback" size={24} color="#000" /> */}
                    <Text style={styles.feedbackButtonText}>Submit Feedback</Text>
                </Pressable>
            )}

            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(!modalVisible)}
            >
                <View style={styles.centeredView}>
                    <View style={styles.modalView}>
                        <TextInput
                            style={styles.feedbackText}
                            onChangeText={setFeedback}
                            value={feedback}
                            placeholder="Type your feedback here..."
                            multiline
                        />
                        <Button title="Submit Feedback" onPress={handleFeedbackSubmit} />
                        <Pressable
                            style={[styles.buttonClose]}
                            onPress={() => setModalVisible(!modalVisible)}
                        >
                            <Text style={styles.textStyle}>Close</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        justifyContent: 'top',
        alignItems: 'center',
        marginTop: 50,
    },
    toggleText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#3273a8',
        marginBottom: 10,
    },
    modalView: {
    }
});

export default UserSettingsComponent;