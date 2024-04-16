import React, { useState, useRef, useEffect, forwardRef } from 'react';
import { View, Text, Button, TouchableOpacity, StyleSheet, TextInput, Modal, PanResponder, Image, NativeEventEmitter, NativeModules, Alert } from 'react-native';
import { RNCamera } from 'react-native-camera';
import Video from 'react-native-video';
import { showEditor } from 'react-native-video-trim';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import * as FileSystem from 'expo-file-system';
import RNFS from 'react-native-fs';
import DocumentPicker from 'react-native-document-picker';
import { FFmpegKit } from 'ffmpeg-kit-react-native';
import { PinchGestureHandler, State } from 'react-native-gesture-handler';
import Animated, { Value, event, set } from 'react-native-reanimated';


const App = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedSeconds, setRecordedSeconds] = useState(0);
  const cameraRef = useRef(null);
  const [videoUri, setVideoUri] = useState(null);
  const [isTrimming, setIsTrimming] = useState(false);
  const [isAddingText, setIsAddingText] = useState(false);
  const [textOverlayList, setTextOverlayList] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [muteOriginalSound, setMuteOriginalSound] = useState(false); // State to track muting original sound
  const [externalAudioUri, setExternalAudioUri] = useState(null);
  const [check, setCheck] = useState(0)
  const [addedVideoUri, setAddedVideoUri] = useState(null);

  const videoContainerRef = useRef(null);

  useEffect(() => {
    let timer;
    if (isRecording) {
      timer = setInterval(() => {
        setRecordedSeconds((prevSeconds) => prevSeconds + 1);
      }, 1000);
    } else {
      setRecordedSeconds(0);
    }
    return () => clearInterval(timer);
  }, [isRecording]);

  const startRecording = async () => {
    setIsRecording(true);
    if (cameraRef.current) {
      const options = {};
      const data = await cameraRef.current.recordAsync(options);
      console.log('Recorded Video:', data.uri);
      setVideoUri(data.uri);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (cameraRef.current) {
      cameraRef.current.stopRecording();
      setIsRecording(false);
      setCheck(5)
    }
  };

  const trimVideo = () => {
    showEditor(videoUri);
  };

  useEffect(() => {
    const eventEmitter = new NativeEventEmitter(NativeModules.VideoTrim);
    const subscription = eventEmitter.addListener('VideoTrim', (event) => {
      switch (event.name) {
        case 'onShow': {
          // on Dialog show
          console.log('onShowListener', event);
          break;
        }
        case 'onHide': {
          // on Dialog hide
          console.log('onHide', event);
          break;
        }
        case 'onStartTrimming': {
          // on start trimming
          console.log('onStartTrimming', event);
          break;
        }
        case 'onFinishTrimming': {
          // on trimming is done
          setVideoUri(event.outputPath)
          // console.log('onFinishTrimming', event);
          break;
        }
        case 'onCancelTrimming': {
          // when user clicks Cancel button
          console.log('onCancelTrimming', event);
          break;
        }
        case 'onError': {
          // any error occured: invalid file, lack of permissions to write to photo/gallery, unexpected error...
          console.log('onError', event);
          break;
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const handleAddText = () => {
    setIsAddingText(true);
    setModalVisible(true);
  };

  const handleOverlayText = () => {
    setIsAddingText(false);
    setModalVisible(false);
    if (textInput !== '') {
      setTextOverlayList([...textOverlayList, { text: textInput, position: { x: 10, y: 10 } }]);
      setTextInput('');
    }
  };

  const removeText = (index) => {
    const updatedTextOverlayList = [...textOverlayList];
    updatedTextOverlayList.splice(index, 1);
    setTextOverlayList(updatedTextOverlayList);
  };

  const handlePanResponderMove = (index, event, gestureState) => {
    const { layout } = videoContainerRef; // Get the layout of the video container
    const overlaySize = 100; // Adjust as needed

    const maxX = '100%' - overlaySize; // Maximum X coordinate
    const maxY = 600 - overlaySize; // Maximum Y coordinate

    let x = gestureState.moveX - overlaySize / 2; // Adjust for overlay size
    let y = gestureState.moveY - overlaySize / 2; // Adjust for overlay size

    // Constrain X coordinate within bounds
    if (x < 0) {
      x = 0;
    } else if (x > maxX) {
      x = maxX;
    }

    // Constrain Y coordinate within bounds
    if (y < 0) {
      y = 0;
    } else if (y > maxY) {
      y = maxY;
    }

    const updatedTextOverlayList = [...textOverlayList];
    updatedTextOverlayList[index].position = { x, y };
    setTextOverlayList(updatedTextOverlayList);
  };


  // const imageScales = textOverlayList.map(() => new Value(1));

  // const handlePinchGesture = (event, index) => Animated.event(
  //   [{ nativeEvent: { scale: imageScales[index] } }],
  //   { useNativeDriver: true }
  // );

  // const handlePinchStateChange = (event, index) => {
  //   if (event.nativeEvent.oldState === State.ACTIVE) {
  //     const { scale } = event.nativeEvent;
  //     imageScales[index] = set(imageScales[index], scale);
  //   }
  // };

  const handleAddImage = async () => {

    const options = {
      mediaType: 'photo',
      includeBase64: false,
      maxHeight: 2000,
      maxWidth: 2000,
    };

    launchImageLibrary(options, (response) => {
      if (response.didCancel) {
        console.log('User cancelled image picker');
      } else if (response.error) {
        console.log('Image picker error: ', response.error);
      } else {
        let imageUri = response.uri || response.assets?.[0]?.uri;
        setTextOverlayList([...textOverlayList, { image: imageUri, position: { x: 10, y: 10 } }]);
      }
    });

  };


  const addVideoOnVideo = () => {
    const options = {
      mediaType: 'video',
      videoQuality: 'high',
    };

    launchImageLibrary(options, (response) => {
      // if (!response.didCancel && !response.error) {
      //   const selectedVideoUri = response.uri || response.assets?.[0]?.uri;
      //   setAddedVideoUri(selectedVideoUri);
      // }

      if (response.didCancel) {
        console.log('User cancelled image picker');
      } else if (response.error) {
        console.log('Image picker error: ', response.error);
      } else {
        let imageUri = response.uri || response.assets?.[0]?.uri;
        setTextOverlayList([...textOverlayList, { videoOver: imageUri, position: { x: 10, y: 10 } }]);
      }
    });
  }

  // const combineVideo = () => {
  //   try {
  //     if (!videoUri) {
  //       Alert.alert('Please select the first video before combining.');
  //       return;
  //     }

  //     const options = {
  //       mediaType: 'video', // Specify that only videos should be selectable
  //       videoQuality: 'high', // Set video quality if needed
  //     };

  //     launchImageLibrary(options, async (response) => {
  //       if (response.didCancel) {
  //         console.log('User cancelled video picker');
  //       } else if (response.error) {
  //         console.log('Video picker error: ', response.error);
  //       } else {
  //         const secondVideoUri = response.uri || response.assets?.[0]?.uri;

  //         // Construct FFmpeg command to concatenate videos
  //         const outputUri = `${RNFS.ExternalDirectoryPath}/merged_video.mp4`;
  //         const ffmpegCommand = `-i ${videoUri} -i ${secondVideoUri} -filter_complex "[0:v:0][1:v:0]concat=n=2:v=1:a=0[outv]" -map "[outv]" -c:v libx264 -preset ultrafast -y ${outputUri}`;

  //         // Execute FFmpeg command
  //         await FFmpegKit.executeAsync(ffmpegCommand);

  //         // Update videoUri with the merged video
  //         setVideoUri(`file://${outputUri}`);
  //       }
  //     });
  //   } catch (error) {
  //     console.error('Error combining videos:', error);
  //     Alert.alert('Failed to combine videos.');
  //   }
  // }
  // const downloadVideo = async () => {
  //   if (!videoUri) {
  //     Alert.alert('No video to download!');
  //     return;
  //   }

  //   const localUri = videoUri.replace('file://', '');
  //   const fileExtension = localUri.split('.').pop();
  //   const newFileName = `overlayed_video.${fileExtension}`;

  //   const downloadDir = `${RNFS.ExternalDirectoryPath}/MubeenEdits`; // Specify the download directory
  //   const downloadUri = `${downloadDir}/${newFileName}`;

  //   try {
  //     // Check if the download directory exists, if not, create it
  //     const dirExists = await RNFS.exists(downloadDir);
  //     if (!dirExists) {
  //       await RNFS.mkdir(downloadDir);
  //     }

  //     // Copy the video file to the download directory
  //     await RNFS.copyFile(localUri, downloadUri);
  //     Alert.alert(`Video downloaded successfully! Location: ${downloadUri}`);

  //     // If needed, you can trigger a media scan to make the video visible in the gallery app

  //   } catch (error) {
  //     console.error('Error saving video:', error);
  //     Alert.alert('Failed to download video!');
  //   }
  // };


  const downloadVideo = async () => {
    // Check if video URI exists
    if (!videoUri) {
      Alert.alert('No video to download!');
      return;
    }

    // Extract file extension and generate new file name
    const localUri = videoUri.replace('file://', '');
    const fileExtension = localUri.split('.').pop();
    const newFileName = `overlayed_video.${fileExtension}`;

    // Specify download directory
    const downloadDir = `${RNFS.ExternalDirectoryPath}`;

    try {
      // Check if download directory exists, if not, create it
      const dirExists = await RNFS.exists(downloadDir);
      if (!dirExists) {
        await RNFS.mkdir(downloadDir);
      }

      // Get the selected image URIs and their positions
      const temp = textOverlayList.map((overlay) => overlay);
      if (temp.length < 2) {
        Alert.alert('At least two image overlays are required!');
        return;
      }

      // Extract image paths and positions
      const imagePath1 = temp[0].image;
      const position1 = temp[0].position;
      const imagePath2 = temp[1].image;
      const position2 = temp[1].position;

      // Generate a random filename
      const rand = Math.floor(100000 + Math.random() * 900000);

      // Construct FFmpeg filter_complex string with image overlay filters
      const overlayFilter1 = `[1:v]scale=200:200[overlay1];[0:v][overlay1]overlay=${position1.x}:${position1.y}:enable='between(t,0,50)'`;
      const overlayFilter2 = `[2:v]scale=200:200[overlay2];[1:v][overlay2]overlay=${position2.x}:${position2.y}:enable='between(t,0,20)'`;

      // Construct FFmpeg command with input, filter_complex, and output
      // const ffmpegCommand = `-i ${localUri} -i ${imagePath1} -i ${imagePath2} -filter_complex "${overlayFilter1},${overlayFilter2}"  -map [v] -map 0:a ${downloadDir}/${rand + newFileName}`;
      // const ffmpegCommand = `-y -i ${localUri} -i ${imagePath1} -i ${imagePath2} -stream_loop -1 -i ${localUri} -filter_complex "[0]split=2[bg][fg];[bg]drawbox=c=black@1:replace=1:t=fill[bg];[bg][fg]overlay=format=auto[v0];[1:v]scale=0:0:flags=neighbor,rotate='0*PI/180:c=none:ow=190:oh=190'[t1];[v0][t1]overlay=x=(W-w-40):y=40[v1];[2:v]scale=0:100:flags=neighbor,rotate='0*PI/180:c=none:ow=250:oh=250'[t2];[v1][t2]overlay=x=40:y=(H-h-40)[v2]" -map "[v2]" -map 0:a -pix_fmt yuv420p -t 6.1 ${downloadDir}/${rand + newFileName}`;

      const ffmpegCommand = `-y -i ${localUri} -i ${imagePath1} -i ${imagePath2} -filter_complex "[0]split=2[bg][fg];[bg]drawbox=c=black@1:replace=1:t=fill[bg];[bg][fg]overlay=format=auto[v0];[1:v]scale=0:0:flags=neighbor,rotate='0*PI/180:c=none:ow=190:oh=190'[t1];[v0][t1]overlay=x=(W-w-40):y=40[v1];[2:v]scale=0:100:flags=neighbor,rotate='0*PI/180:c=none:ow=250:oh=250'[t2];[v1][t2]overlay=x=40:y=(H-h-40)[v2]" -map "[v2]" -map  0:a -q:v 4 -q:a 4 -pix_fmt  yuv420p -t 6.1 ${downloadDir}/${rand + newFileName}`;

      // const ffmpegCommand = `-y -i ${localUri} -i ${imagePath1} -i ${imagePath2} -filter_complex "[0:v]split=2[bg][fg];[bg]drawbox=c=black@1:replace=1:t=fill[bg];[bg][fg]overlay=format=auto[v0];[1:v][v0]overlay=x=(W-w-40):y=40[v1];[2:v][v1]overlay=x=40:y=(H-h-40)[v2]" -map "[v2]" -map 0:a -pix_fmt yuv420p -t 6.1 ${downloadDir}/${rand + newFileName}`;
      

      // const ffmpegCommand = `-y -i ${localUri} -i ${imagePath1} -i ${imagePath2} -filter_complex 
      // "[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2[bg];
      //  [bg][1:v]overlay=x=100:y=100:format=auto[bg1];
      //  [bg1][2:v]overlay=x=500:y=500:format=auto[v]" 
      // -map "[v]" -pix_fmt yuv420p -t 6.1 ${downloadDir}/${rand + newFileName}`;

      // Execute FFmpeg command
      await FFmpegKit.executeAsync(ffmpegCommand);

      // Display success message
      Alert.alert(`Video downloaded successfully! Location: ${downloadDir}/${newFileName}`);
    } catch (error) {
      // Log and display error message
      console.error('Error saving video:', error);
      Alert.alert('Failed to download video!');
    }

  };

  // const downloadVideo = async () => {
  //   // Check if video URI exists
  //   if (!videoUri) {
  //     Alert.alert('No video to download!');
  //     return;
  //   }

  //   // Extract file extension and generate new file name
  //   const localUri = videoUri.replace('file://', '');
  //   const fileExtension = localUri.split('.').pop();
  //   const newFileName = `overlayed_video.${fileExtension}`;

  //   // Specify download directory
  //   const downloadDir = `${RNFS.ExternalDirectoryPath}`;

  //   try {
  //     // Check if download directory exists, if not, create it
  //     const dirExists = await RNFS.exists(downloadDir);
  //     if (!dirExists) {
  //       await RNFS.mkdir(downloadDir);
  //     }

  //     // Construct FFmpeg filter_complex string for each overlay (text and image)
  //     let overlayFilter = '';
  //     textOverlayList.forEach((overlay, index) => {
  //       if (overlay.text) {
  //         overlayFilter += `[${index + 1}:v]drawtext=text='${overlay.text}':x=${overlay.position.x}:y=${overlay.position.y}:fontsize=24:fontcolor=white:box=1:boxcolor=black@0.5:boxborderw=5,`;
  //       } else if (overlay.image) {
  //         overlayFilter += `[${index + 1}:v]overlay=x=${overlay.position.x}:y=${overlay.position.y}:enable='between(t,0,20)',`;
  //       }
  //     });
  //     overlayFilter = overlayFilter.slice(0, -1); // Remove the trailing comma
  //     const rand = Math.floor(100000 + Math.random() * 900000)

  //     // Construct FFmpeg command with input, filter_complex, and output
  //     const ffmpegCommand = `-i ${localUri} ${textOverlayList.map((overlay, index) => `-i ${overlay.image}`).join(' ')} -filter_complex "${overlayFilter}" -map 0:v -map 0:a -c:a copy -y ${downloadDir}/${rand+newFileName}`;

  //     // Execute FFmpeg command
  //     await FFmpegKit.executeAsync(ffmpegCommand);

  //     // Display success message
  //     Alert.alert(`Video downloaded successfully! Location: ${downloadDir}/${newFileName}`);
  //   } catch (error) {
  //     // Log and display error message
  //     console.error('Error saving video:', error);
  //     Alert.alert('Failed to download video!');
  //   }
  // };



  const selectVideoFromLibrary = () => {
    setCheck(1)
    const options = {
      mediaType: 'video', // Specify that only videos should be selectable
      videoQuality: 'high', // Set video quality if needed
    };

    launchImageLibrary(options, (response) => {
      if (response.didCancel) {
        console.log('User cancelled video picker');
      } else if (response.error) {
        console.log('Video picker error: ', response.error);
      } else {
        let videoUri = response.uri || response.assets?.[0]?.uri;
        setVideoUri(videoUri);
      }
    });
  };

  const SelectImagesFromLibrary = () => {
    setCheck(2)
    // const options = {
    //   mediaType: 'photo', // Specify that only images should be selectable
    //   includeBase64: false,
    //   maxHeight: 2000,
    //   maxWidth: 2000,
    // };

    // launchImageLibrary(options, (response) => {
    //   if (response.didCancel) {
    //     console.log('User cancelled image picker');
    //   } else if (response.error) {
    //     console.log('Image picker error: ', response.error);
    //   } else {
    //     let imageUri = response.uri || response.assets?.[0]?.uri;
    //     setTextOverlayList([...textOverlayList, { image: imageUri, position: { x: 10, y: 10 } }]);
    //   }
    // });
  };

  const recordvideo = () => { setCheck(3) }


  const toggleMuteOriginalSound = () => {
    setMuteOriginalSound(!muteOriginalSound);
  };

  // Function to add external audio to the video
  const addExternalAudio = async () => {
    try {
      const res = await DocumentPicker.pick({
        type: [DocumentPicker.types.audio],
      });

      if (res) {
        const audioUri = res[0].uri;

        // Copy the audio file to a temporary directory
        const tempDir = Platform.OS === 'ios' ? RNFS.TemporaryDirectoryPath : RNFS.ExternalDirectoryPath; // Use ExternalDirectoryPath for Android
        const audioPath = `${tempDir}/audio.mp3`;
        await RNFS.copyFile(audioUri, audioPath);

        setExternalAudioUri(audioPath);
        // setTimeout(() => {

        // }, 1000);
      } else {
        console.log('Audio selection cancelled.');
      }
    } catch (error) {
      console.error('Error selecting audio:', error);
    }
  };

  const replaceVideoAudio = async () => {
    try {
      if (videoUri && externalAudioUri) {
        const videoPath = videoUri.replace('file://', '');
        const audioPath = externalAudioUri.replace('file://', '');
        const rand = Math.floor(100000 + Math.random() * 900000)
        const outputPath = `${RNFS.ExternalDirectoryPath}/${rand}merged_video.mp4`;

        // Adjust the FFmpeg command to replace the original audio with the selected audio and mute the original audio
        const ffmpegCommand = `-i ${videoPath} -i ${audioPath} -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 -strict experimental -shortest ${outputPath}`;

        await FFmpegKit.executeAsync(ffmpegCommand);

        setVideoUri(`file://${outputPath}`);
        Alert.alert('Audio replaced successfully!');
      } else {
        Alert.alert('Please select both video and audio to replace audio.');
      }
    } catch (error) {
      console.error('Error replacing audio:', error);
      Alert.alert('Failed to replace audio.');
    }
  };




  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        {videoUri ? (
          <View style={{ flex: 1 }}>
            <View style={{ height: 600 }}>
              <VideoPlayer videoUri={videoUri} ref={videoContainerRef} mute={muteOriginalSound} />
              {textOverlayList.map((overlay, index) => (
                <View
                  key={index}
                  style={[styles.overlayTextView, { left: overlay.position.x, top: overlay.position.y, }]}
                  {...PanResponder.create({
                    onStartShouldSetPanResponder: () => true,
                    onPanResponderMove: (event, gestureState) => handlePanResponderMove(index, event, gestureState),
                    onPanResponderRelease: () => { },
                  }).panHandlers}
                >
                  {/* <PinchGestureHandler
                    onGestureEvent={(event) => handlePinchGesture(event, index)}
                    onHandlerStateChange={(event) => handlePinchStateChange(event, index)}
                  > */}

                  {overlay.text && (
                    <Text style={styles.overlayText}>{overlay.text}</Text>
                  )}
                  {/* {overlay.image && (
                      <Image source={{ uri: overlay.image }} style={{ width: 100, height: 100 }} />
                    )} */}
                  {/* <Animated.View style={{ width: '100%', height: '100%' }}> */}
                  {overlay.image && (
                    <Image source={{ uri: overlay.image }} style={{ width: 100, height: 100 }} />

                  )}
                  {/* </Animated.View> */}
                  {overlay.videoOver && (
                    <Video source={{ uri: overlay.videoOver }}
                      style={{ width: 200, height: 200 }}
                      resizeMode="cover"
                      mute={true}
                      controls={true}
                    />
                  )}
                  <TouchableOpacity
                    style={{ position: 'absolute', top: 0, right: 0 }}
                    onPress={() => removeText(index)}
                  >
                    <Image
                      source={{ uri: "https://www.pngall.com/wp-content/uploads/4/Cancel-Button-PNG-Free-Download.png" }}
                      style={{ width: 20, height: 20 }}
                    />
                  </TouchableOpacity>
                  {/* </PinchGestureHandler> */}
                </View>
              ))}
            </View>
            <View style={{ width: "100%", flexDirection: "row", height: 200 }}>
              <View style={{ flex: 1, alignSelf: "center", justifyContent: "center" }}>
                <TouchableOpacity
                  style={{ backgroundColor: 'gray', margin: 5, padding: 10 }}
                  onPress={trimVideo}
                >
                  <Text style={{ textAlign: "center", color: "white", fontSize: 16 }}>
                    Trim Video
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1, alignSelf: "center", justifyContent: "center" }}>
                <TouchableOpacity
                  style={{ backgroundColor: 'gray', margin: 5, padding: 10 }}
                  onPress={handleAddText}
                >
                  <Text style={{ textAlign: "center", color: "white", fontSize: 16 }}>
                    Add Text
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1, alignSelf: "center", justifyContent: "center" }}>
                <TouchableOpacity style={{ backgroundColor: 'gray', margin: 5, padding: 10 }} onPress={handleAddImage}>
                  <Text style={{ textAlign: "center", color: "white", fontSize: 16 }}>
                    Add Image
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1, alignSelf: "center", justifyContent: "center" }}>
                <TouchableOpacity style={{ backgroundColor: 'gray', margin: 5, padding: 10 }} onPress={addVideoOnVideo}>
                  <Text style={{ textAlign: "center", color: "white", fontSize: 16 }}>
                    Add Video
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1, alignSelf: "center", justifyContent: "center" }}>
                {/* <TouchableOpacity style={{ backgroundColor: 'gray', margin: 5, padding: 10 }} onPress={downloadVideo}> */}
                <TouchableOpacity style={{ backgroundColor: 'gray', margin: 5, padding: 10 }} onPress={externalAudioUri ? replaceVideoAudio : addExternalAudio}>
                  <Text style={{ textAlign: "center", color: "white", fontSize: 16 }}>
                    {externalAudioUri ? "Convert" : "Select"} Audio
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1, alignSelf: "center", justifyContent: "center" }}>
                <TouchableOpacity style={{ backgroundColor: 'gray', margin: 5, padding: 10 }} onPress={downloadVideo}>
                  {/* <TouchableOpacity style={{ backgroundColor: 'gray', margin: 5, padding: 10 }} onPress={externalAudioUri ? replaceVideoAudio : addExternalAudio}> */}
                  <Text style={{ textAlign: "center", color: "white", fontSize: 16 }}>
                    Download Video
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

          </View>
        ) : (
          check === 0 && (<View style={{ flex: 1, justifyContent: "center", alignContent: "center", }}>
            <Button title="Select Video" onPress={selectVideoFromLibrary} />
            <View style={{ paddingVertical: 10 }}></View>
            <Button title="Select Image" onPress={() => { }} />
            <View style={{ paddingVertical: 10 }}></View>
            <Button title="Record Video" onPress={recordvideo} />
          </View>
          )

        )}

        {check === 3 && (
          <View style={{ flex: 1, }}>
            <RNCamera
              ref={cameraRef}
              style={{ flex: 1 }}
              type={RNCamera.Constants.Type.back}
              captureAudio={true}
            />
          </View>
        )}
      </View>


      {!videoUri && check === 3 && (
        <View style={{ alignItems: 'center', marginBottom: 20 }}>
          <Text>{recordedSeconds} sec</Text>
          {!isRecording ? (
            <Button title="Record Video" onPress={startRecording} />
          ) : (
            <Button title="Stop Recording" onPress={stopRecording} />
          )}
        </View>
      )}

      {/* Button to toggle muting original sound */}
      {videoUri && (
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
          <TouchableOpacity onPress={toggleMuteOriginalSound}>
            <Text style={{ color: 'blue' }}>{muteOriginalSound ? 'Unmute' : 'Mute'} Original Sound</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Button to add external audio */}
      {/* {videoUri && (
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 10 }}>
          <TouchableOpacity onPress={addExternalAudio}>
            <Text style={{ color: 'blue', textAlign: "center" }}>Add External Audio</Text>
            <Text style={{ color: 'blue', textAlign: "center" }}>{externalAudioUri}</Text>
          </TouchableOpacity>
        </View>
      )} */}


      {/* Modal for adding text */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalView}>
          <TextInput
            style={styles.input}
            onChangeText={setTextInput}
            value={textInput}
            placeholder="Enter text..."
          />
          <View style={{ flexDirection: 'row' }}>
            <Button title="Cancel" onPress={() => setModalVisible(false)} />
            <Button title="Okay" onPress={handleOverlayText} />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const VideoPlayer = forwardRef(({ videoUri, mute }, ref) => {
  return (
    <View style={{ flex: 1 }} ref={ref}>
      <Video
        source={{ uri: videoUri }}
        style={{ width: "100%", height: 600, backgroundColor: "black" }}
        resizeMode="contain"
        controls={true}
        muted={mute}
      />
    </View>
  );
});


const styles = StyleSheet.create({
  modalView: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5
  },
  input: {
    height: 40,
    width: '100%',
    marginBottom: 20,
    borderColor: 'gray',
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 10
  },
  overlayTextView: {
    position: 'absolute',
    top: 20, // Adjust the top position as needed
    left: 20, // Adjust the left position as needed
    backgroundColor: "red",
  },
  overlayText: {
    fontSize: 25,
    fontWeight: 'bold',
    color: 'white',
  },
  addButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: 'gray',
    padding: 10,
    borderRadius: 5,
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
  },
});

export default App;
