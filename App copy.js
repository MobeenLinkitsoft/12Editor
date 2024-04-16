import React from 'react';
import { StyleSheet, View } from 'react-native';
import VideoWithOverlays from './VideoOverlay';

export default function App() {
    // a static image stored into the assets folder
    const imgLy = require('./IMG_LY.jpg');
    
    return (
        <View style={styles.container}>
            <VideoWithOverlays
                videoComponentProps={{
                    // replace this free video source with your video
                    source: {uri: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'}
                }}
                // overlay text
                text={"IDDWDWSDMG.LY"}
                // overlay image
                imageSrc={imgLy}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
    },
});
