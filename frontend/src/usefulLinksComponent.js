import { React,useState } from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import { SiAdp } from "react-icons/si";
import { TbTargetArrow } from "react-icons/tb";
import { FaHandsHelping } from "react-icons/fa";

const UsefulLinksComponent = () => {
    const [expanded, setExpanded] = useState(false);

    const handleLinkPress = (url) => {
        Linking.openURL(url);
    };

    return (
        <View style={styles.container}>
            <Pressable onPress={() => setExpanded(!expanded)}>
                <Text style={styles.toggleText}>{expanded ? 'Collapse' : 'Useful Links'}</Text>
            </Pressable>

            {expanded && (
                <>
                    <View style={styles.iconLink}>
                        <Pressable onPress={() => handleLinkPress('https://workforcenow.adp.com/')}>
                            <SiAdp style={{ fontSize: 36, color: '#FF5733' }} />
                        </Pressable>
                        <Text style={styles.linkText}>Payroll, tax, health insurance and PTO</Text>
                    </View>
                    <View style={styles.iconLink}>
                        <Pressable onPress={() => handleLinkPress('https://kapnickstrive.com/')}>
                            <TbTargetArrow style={{ fontSize: 36, color: "#3273a8" }} />
                        </Pressable>
                        <Text style={styles.linkText}>Wellness&Health activities</Text>
                    </View>
                    <View style={styles.iconLink}>
                        <Pressable onPress={() => handleLinkPress('https://rtutglovebox.com/')}>
                            <FaHandsHelping style={{ fontSize: 36, color: "#32a867" }} />
                        </Pressable>
                        <Text style={styles.linkText}>Safety data sheet, training, policy and HR work flows</Text>
                    </View>                
                </>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        justifyContent: 'top',
        alignItems: 'center',
        marginTop: 50,
    },
    iconLink: {
        flexDirection: 'column',
        alignItems: 'center',
        marginVertical: 10,
    },
    linkText: {
        fontSize: 12,
        color: 'black',
        textAlign: 'justify',
    },
    toggleText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#3273a8',
        marginBottom: 10,
    },
});

export default UsefulLinksComponent;
