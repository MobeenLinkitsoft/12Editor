import React, { useEffect, useState } from 'react';
import { Image, PanResponder, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Video from 'react-native-video';

export default function VideoWithOverlays({ videoComponentProps, text, imageSrc }) {
    const {
        video,
        overlayText,
        videoWithOverlays,
        overlayTextView,
        overlayImageView,
        overlayImage
    } = styles;

    const [imagePosition, setImagePosition] = useState({ x: 10, y: 10 }); // Initial image position
    const [panResponder, setPanResponder] = useState(null);

    useEffect(() => {
        // Initialize pan responder
        const panResponder = PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onPanResponderMove: (event, gestureState) => {
                // Update image position based on gesture movement
                setImagePosition({
                    x: gestureState.moveX - 50, // Adjust for image width
                    y: gestureState.moveY - 50, // Adjust for image height
                });
            },
            onPanResponderRelease: () => {},
        });

        setPanResponder(panResponder);
    }, []);

    return (
        <View style={videoWithOverlays}>
            <Video
                {...videoComponentProps}
                style={video}
            />
            <View style={overlayTextView}>
                {text && <Text style={overlayText}>{text}</Text>}
            </View>
            <View
                {...panResponder.panHandlers}
                style={[overlayImageView, { left: imagePosition.x, top: imagePosition.y }]}
            >
                {imageSrc && <Image style={overlayImage} source={imageSrc} resizeMode='contain' />}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    overlayTextView: {
        position: 'absolute',
        top: 20, // Adjust the top position as needed
        left: 20, // Adjust the left position as needed
        backgroundColor: "red"
    },
    overlayImageView: {
        position: 'absolute',
    },
    overlayImage: {
        width: 100,
        height: 100,
    },
    overlayText: {
        fontSize: 25,
        fontWeight: 'bold',
        color: 'white',
    },
    video: {
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
    },
    videoWithOverlays: {
        position: 'relative',
        width: '100%',
        height: '100%',
    }
});
