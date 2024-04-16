import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Button, TouchableOpacity, StyleSheet, TextInput, Modal, PanResponder, Image } from 'react-native';
import { RNCamera } from 'react-native-camera';
import Video from 'react-native-video';
import { showEditor } from 'react-native-video-trim';

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
      const options = { maxDuration: 12 };
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
    }
  };

  const trimVideo = () => {
    showEditor(videoUri);
  };

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
    const updatedTextOverlayList = [...textOverlayList];
    updatedTextOverlayList[index].position = {
      x: gestureState.moveX - 50, // Adjust for text width
      y: gestureState.moveY - 50, // Adjust for text height
    };
    setTextOverlayList(updatedTextOverlayList);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        {videoUri ? (
          <View style={{ flex: 1 }}>
            <VideoPlayer videoUri={videoUri} />
            {textOverlayList.map((textOverlay, index) => (
              <View
                key={index}
                style={[styles.overlayTextView, { left: textOverlay.position.x, top: textOverlay.position.y }]}
                {...PanResponder.create({
                  onStartShouldSetPanResponder: () => true,
                  onPanResponderMove: (event, gestureState) => handlePanResponderMove(index, event, gestureState),
                  onPanResponderRelease: () => {},
                }).panHandlers}
              >
                <Text style={styles.overlayText}>{textOverlay.text}</Text>
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
                <TouchableOpacity style={{ backgroundColor: 'gray', margin: 5, padding: 10 }}>
                  <Text style={{ textAlign: "center", color: "white", fontSize: 16 }}>
                    Add Image
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1, alignSelf: "center", justifyContent: "center" }}>
                <TouchableOpacity style={{ backgroundColor: 'gray', margin: 5, padding: 10 }}>
                  <Text style={{ textAlign: "center", color: "white", fontSize: 16 }}>
                    Download
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : (
          <RNCamera
            ref={cameraRef}
            style={{ flex: 1 }}
            type={RNCamera.Constants.Type.back}
            captureAudio={true}
          />
        )}
      </View>
      {!videoUri && (
        <View style={{ alignItems: 'center', marginBottom: 20 }}>
          <Text>{recordedSeconds} / 12 sec</Text>
          {!isRecording ? (
            <Button title="Record Video" onPress={startRecording} />
          ) : (
            <Button title="Stop Recording" onPress={stopRecording} />
          )}
        </View>
      )}

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

const VideoPlayer = ({ videoUri }) => {
  return (
    <View style={{ flex: 1 }}>
      <Video
        source={{ uri: videoUri }}
        style={{ width: "100%", height: 500, backgroundColor: "black", }}
        resizeMode="contain"
        controls={true}
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
    backgroundColor: "red"
  },
  overlayText: {
    fontSize: 25,
    fontWeight: 'bold',
    color: 'white',
  },
});

export default App;