import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Button, TouchableOpacity, StyleSheet, TextInput, Modal, PanResponder, Image, NativeEventEmitter, NativeModules, Alert } from 'react-native';
import { RNCamera } from 'react-native-camera';
import Video from 'react-native-video';
import { showEditor } from 'react-native-video-trim';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import * as FileSystem from 'expo-file-system';
import RNFS from 'react-native-fs';
import DocumentPicker from 'react-native-document-picker';
import {
  mergeVideoAndAudio,
  removeAudio,
  fastAndSlow,
  trimVideo,
  cropAudio,
} from 'react-native-audio-remove';

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


  const downloadVideo = async () => {
    if (!videoUri) {
      Alert.alert('No video to download!');
      return;
    }

    const localUri = videoUri.replace('file://', '');
    const fileExtension = localUri.split('.').pop();
    const newFileName = `overlayed_video.${fileExtension}`;

    const downloadDir = `${RNFS.ExternalDirectoryPath}/MubeenEdits`; // Specify the download directory
    const downloadUri = `${downloadDir}/${newFileName}`;

    try {
      // Check if the download directory exists, if not, create it
      const dirExists = await RNFS.exists(downloadDir);
      if (!dirExists) {
        await RNFS.mkdir(downloadDir);
      }

      // Copy the video file to the download directory
      await RNFS.copyFile(localUri, downloadUri);
      Alert.alert(`Video downloaded successfully! Location: ${downloadUri}`);

      // If needed, you can trigger a media scan to make the video visible in the gallery app

    } catch (error) {
      console.error('Error saving video:', error);
      Alert.alert('Failed to download video!');
    }
  };



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
      // Open document picker to select audio files
      const res = await DocumentPicker.pick({
        type: [DocumentPicker.types.audio],
      });

      // Check if audio file is selected
      if (res) {
        // Get the URI of the selected audio
        const audioUri = res.uri;

        // Set the external audio URI
        setExternalAudioUri(audioUri);
      } else {
        // Audio selection was cancelled
        console.log('Audio selection cancelled.');
      }
    } catch (error) {
      // Handle error
      console.error('Error selecting audio:', error);
    }
  };

  const removeAudioFromVideo = () => {
    removeAudio({
      path: videoUri,
    })
      .then((res) => {
        console.log(res);

        setResult(res);
      })
      .catch((err) => console.log(err));
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
                  {overlay.text && (
                    <Text style={styles.overlayText}>{overlay.text}</Text>
                  )}
                  {overlay.image && (
                    <Image source={{ uri: overlay.image }} style={{ width: 100, height: 100 }} />
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
                <TouchableOpacity style={{ backgroundColor: 'gray', margin: 5, padding: 10 }} onPress={downloadVideo}>
                  <Text style={{ textAlign: "center", color: "white", fontSize: 16 }}>
                    Download
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : (
          check === 0 && (<View style={{ flex: 1, justifyContent: "center", alignContent: "center", }}>
            <Button title="Select Video" onPress={selectVideoFromLibrary} />
            <View style={{ paddingVertical: 10 }}></View>
            <Button title="Select Image" onPress={SelectImagesFromLibrary} />
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
      {videoUri && (
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 10 }}>
          <TouchableOpacity onPress={addExternalAudio}>
            <Text style={{ color: 'blue' }}>Add External Audio</Text>
          </TouchableOpacity>
        </View>
      )}
      <TouchableOpacity onPress={removeAudioFromVideo}>
        <Text style={{ color: 'blue' }}>Remove Audio</Text>
      </TouchableOpacity>

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

const VideoPlayer = ({ videoUri, mute }) => {
  const videoContainerRef = useRef(null);

  return (
    <View style={{ flex: 1 }}
      ref={videoContainerRef}
      onLayout={() => {
        // Do nothing for now
      }}>
      <Video
        source={{ uri: videoUri }}
        style={{ width: "100%", height: 600, backgroundColor: "black", }}
        resizeMode="contain"
        controls={true}
        muted={mute}
      />
    </View>
  );
};

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
