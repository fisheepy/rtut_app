import { React,useState } from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import { SiAdp } from "react-icons/si";
import { TbTargetArrow } from "react-icons/tb";
import { FaHandsHelping } from "react-icons/fa";
import commonStyles from './styles/commonStyles';

const UsefulLinksComponent = () => {
    const [expanded, setExpanded] = useState(false);

    const handleLinkPress = (url) => {
        Linking.openURL(url);
    };

    return (
        <View style={commonStyles.useSetting.container}>
            <Pressable onPress={() => setExpanded(!expanded)}>
                <Text style={commonStyles.useSetting.toggleText}>{expanded ? 'Collapse' : 'Useful Links'}</Text>
            </Pressable>

            {expanded && (
                <>
                    <View style={commonStyles.useSetting.iconLink}>
                        <Pressable onPress={() => handleLinkPress('https://workforcenow.adp.com/')}>
                            <SiAdp style={{ fontSize: 36, color: '#FF5733' }} />
                        </Pressable>
                        <Text style={commonStyles.useSetting.linkText}>Payroll, tax, health insurance and PTO</Text>
                    </View>
                    <View style={commonStyles.useSetting.iconLink}>
                        <Pressable onPress={() => handleLinkPress('https://kapnickstrive.com/')}>
                            <TbTargetArrow style={{ fontSize: 36, color: "#3273a8" }} />
                        </Pressable>
                        <Text style={commonStyles.useSetting.linkText}>Wellness&Health activities</Text>
                    </View>
                    <View style={commonStyles.useSetting.iconLink}>
                        <Pressable onPress={() => handleLinkPress('https://rtutglovebox.com/')}>
                            <FaHandsHelping style={{ fontSize: 36, color: "#32a867" }} />
                        </Pressable>
                        <Text style={commonStyles.useSetting.linkText}>Safety data sheet, training, policy and HR work flows</Text>
                    </View>                
                </>
            )}
        </View>
    );
};

export default UsefulLinksComponent;
