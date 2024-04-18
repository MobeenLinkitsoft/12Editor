import React, { useState, useRef, useEffect, forwardRef } from 'react';
import { View, Text, Button, TouchableOpacity, StyleSheet, TextInput, Modal, PanResponder, Image, NativeEventEmitter, NativeModules, Alert, PermissionsAndroid } from 'react-native';
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
import RNFetchBlob from 'rn-fetch-blob';
import { Asset } from 'expo-asset';


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
  const [colorText, setcolorText] = useState('white');
  const [textSize, setTextSize] = useState(16);

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


  const addVideoOnVideo = () => {
    const options = {
      mediaType: 'video',
      videoQuality: 'high',
    };

    // Launch the video picker
    launchImageLibrary(options, (response) => {
      if (response.didCancel) {
        console.log('User cancelled video picker');
      } else if (response.error) {
        console.log('Video picker error: ', response.error);
      } else {
        // Get the URI of the selected video
        let selectedVideoUri = response.uri || response.assets?.[0]?.uri;

        // Merge the selected video with the current video
        mergeVideos(selectedVideoUri);
      }
    });
  }


  const mergeVideos = async (selectedVideoUri) => {
    try {
      // Get the paths of the existing video and the selected video
      const existingVideoPath = videoUri.replace('file://', '');
      const selectedVideoPath = selectedVideoUri.replace('file://', '');
      const datetime = new Date().toLocaleTimeString().replace(':', '').replace(' ', '');

      // Generate a unique filename for the merged video
      const mergedVideoPath = `${RNFS.ExternalDirectoryPath}/${datetime}merged_video.mp4`;

      // Create a text file containing the paths of the videos to concatenate
      const fileListPath = `${RNFS.ExternalDirectoryPath}/filelist.txt`;
      await RNFS.writeFile(fileListPath, `file '${existingVideoPath}'\nfile '${selectedVideoPath}'`);

      // Define FFmpeg command to concatenate the videos
      const command = `-f concat -safe 0 -i ${fileListPath} -c copy ${mergedVideoPath}`;

      Timer()
      // Execute FFmpeg command
      await FFmpegKit.executeAsync(command);

      // Set the videoUri state to the URI of the merged video
      setTimeout(() => {
        setVideoUri(`file://${mergedVideoPath}`);
      }, 4000);

      // Display success message
      console.log('Videos merged successfully!');
    } catch (error) {
      // Log and display error message
      console.error('Error merging videos:', error);
      Alert.alert('Failed to merge videos!');
    }
  };


  const [progress, setProgress] = useState(0);

  const Timer = () => {
    const totalTime = 10000; // 10 seconds in milliseconds
    let currentTime = 0;

    const timer = setInterval(() => {
      currentTime += 100;
      const newProgress = (currentTime / totalTime) * 100;
      setProgress(newProgress);

      if (currentTime >= totalTime) {
        Alert.alert('Video downloaded successfully!')
        clearInterval(timer);
      }
    }, 100);

    return () => clearInterval(timer);
  }


  const requestWriteExternalStoragePermission = async () => {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        {
          title: 'Storage Permission Required',
          message:
            'This app needs access to your storage to download the video.',
          buttonPositive: 'OK',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (error) {
      console.error('Error requesting permission:', error);
      return false;
    }
  };


  const checkWriteExternalStoragePermission = async () => {
    try {
      const granted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      );
      return granted;
    } catch (error) {
      console.error('Error checking permission:', error);
      return false;
    }
  };



  // const downloadVideo = async () => {
  //   // Check if video URI exists
  //   if (!videoUri) {
  //     Alert.alert('No video to download!');
  //     return;
  //   }

  //   const isPermissionGranted = await checkWriteExternalStoragePermission();
  //   if (!isPermissionGranted) {
  //     const permissionGranted = await requestWriteExternalStoragePermission();
  //     if (!permissionGranted) {
  //       Alert.alert('Permission denied. Cannot download video.');
  //       return;
  //     }
  //   }

  //   // Extract file extension and generate new file name
  //   const localUri = videoUri.replace('file://', '');
  //   const fileExtension = localUri.split('.').pop();
  //   const datetime = new Date().toLocaleTimeString().replace(':', '').replace(' ', '');
  //   const newFileName = `${datetime}overlayed_video.${fileExtension}`;
  //   // Specify download directory
  //   const downloadDir = `${RNFS.DownloadDirectoryPath}`;

  //   try {
  //     // Check if download directory exists, if not, create it
  //     const dirExists = await RNFS.exists(downloadDir);
  //     if (!dirExists) {
  //       await RNFS.mkdir(downloadDir);
  //     }

  //     // Construct FFmpeg filter_complex string with dynamic text overlay filters
  //     let filterComplex = '';
  //     let imageCount = 0;
  //     let textCount = 0;
  //     let overlayInputs = '';
  //     const rand = Math.floor(100000 + Math.random() * 900000);

  //     // Loop through each text overlay in textOverlayList
  //     textOverlayList.forEach((overlay, index) => {
  //       if (overlay.image) {
  //         const imagePath = overlay.image;
  //         const position = overlay.position;
  //         const overlayInput = `-i ${imagePath}`;
  //         overlayInputs += overlayInput;

  //         filterComplex += `[${index + 1}:v]scale=200:200[t${index + 1}];${index == 0 ? `[0:v]` : `[v${index}]`}[t${index + 1}]overlay=x=${position.x}:y=${position.y}[v${index + 1}]${index !== textOverlayList.length - 1 ? ';' : ''}`
  //         imageCount++;
  //       }

  //       else if (overlay.text) {

  //         const text = overlay.text;
  //         const position = overlay.position;

  //         // Add text overlay filter for each text item
  //         filterComplex += `drawtext=fontfile=/system/fonts/Roboto-Regular.ttf:text=${text}:fontcolor=${colorText}:fontsize=${textSize}:x=${position.x}:y=${position.y}${index !== textOverlayList.length - 1 ? ',' : ''}`;
  //         textCount++;
  //       }
  //     });

  //     const overlayMap = `[v${textOverlayList.length}]`;

  //     // Construct the FFmpeg command
  //     let ffmpegCommand;
  //     if (imageCount > 0 && textCount > 0) {
  //       // If both image and text overlays exist
  //       ffmpegCommand = `-y -i ${localUri} ${textOverlayList.map((overlay, index) => `-i ${overlay.image}`).join(' ')} -filter_complex "${filterComplex}${overlayMap}" -map "${overlayMap}" -map 0:a -q:v 4 -q:a 4 -pix_fmt yuv420p ${downloadDir}/${rand + newFileName}`;
  //     } else if (imageCount > 0) {
  //       // If only image overlays exist
  //       ffmpegCommand = `-y -i ${localUri} ${textOverlayList.map((overlay, index) => `-i ${overlay.image}`).join(' ')} -filter_complex "${filterComplex}" -map "${overlayMap}" -map 0:a -q:v 4 -q:a 4 -pix_fmt yuv420p -t 6.1 ${downloadDir}/${rand + newFileName}`;
  //     } else if (textCount > 0) {
  //       // If only text overlays exist
  //       ffmpegCommand = `-i ${localUri} -filter_complex "${filterComplex}" -codec:a copy -q:v 4 -q:a 4 ${downloadDir}/${newFileName}`;
  //     } else {
  //       // If no overlays exist
  //       ffmpegCommand = `-y -i ${localUri} -c copy ${downloadDir}/${newFileName}`;
  //     }

  //     // Execute FFmpeg command
  //     await FFmpegKit.executeAsync(ffmpegCommand);

  //     // Display success message
  //     console.log(`Video downloaded successfully! Location: ${downloadDir}/${newFileName}`);
  //   } catch (error) {
  //     // Log and display error message
  //     console.error('Error saving video:', error);
  //     Alert.alert('Failed to download video!');
  //   }
  // };


  const downloadVideoONe = async () => {
    // Check if video URI exists
    if (!videoUri) {
      Alert.alert('No video to download!');
      return;
    }

    const isPermissionGranted = await checkWriteExternalStoragePermission();
    if (!isPermissionGranted) {
      const permissionGranted = await requestWriteExternalStoragePermission();
      if (!permissionGranted) {
        Alert.alert('Permission denied. Cannot download video.');
        return;
      }
    }

    // Extract file extension and generate new file name
    const localUri = videoUri.replace('file://', '');
    const fileExtension = localUri.split('.').pop();
    const datetime = new Date().toLocaleTimeString().replace(':', '').replace(' ', '');
    const newFileName = `${datetime}overlayed_video.${fileExtension}`;
    // Specify download directory
    const downloadDir = `${RNFS.DownloadDirectoryPath}`;

    try {
      // Check if download directory exists, if not, create it
      const dirExists = await RNFS.exists(downloadDir);
      if (!dirExists) {
        await RNFS.mkdir(downloadDir);
      }

      // Construct FFmpeg filter_complex string with dynamic text overlay filters
      let filterComplex = '';
      let overlayInputs = '';
      let overlayMaps = '';
      let imageCount = 0;
      let textCount = 0;
      const rand = Math.floor(100000 + Math.random() * 900000);

      // Loop through each overlay in textOverlayList
      textOverlayList.forEach((overlay, index) => {
        if (overlay.image) {
          const imagePath = overlay.image;
          const position = overlay.position;
          const overlayInput = `-i ${imagePath}${imageCount > 0 ? ' ' : ''
            } `;
          overlayInputs += overlayInput;
          filterComplex += `[${index + 1}:v]scale=100:100[t${index + 1}];${index == 0 ? `[0:v]` : `[v${index}]`}[t${index + 1}]overlay=x=${position.x}:y=${position.y}[v${index + 1}]${index !== textOverlayList.length - 1 ? ';' : ''}`

          // filterComplex += `${imageCount === 0 && textCount === 0 ? '' : ';'}[${index + 1}:v]scale=200:200[t${index}];${imageCount === 0 && textCount === 0 ? '[0:v]' : `[v${index}]`}[t${index+1}]overlay=x=${position.x}:y=${position.y}[v${index + 1}]${index !== textOverlayList.length - 1 ? ';' : ''}`;
          overlayMaps += `[v${index}]`;
          imageCount++;
        } else if (overlay.text) {
          const text = overlay.text;
          const position = overlay.position;

          // Add text overlay filter for each text item
          // filterComplex += `${imageCount === 0 && textCount === 0 ? '' : ';'}[${index}:v]drawtext=fontfile=/system/fonts/Roboto-Regular.ttf:text=${text}:fontcolor=${colorText}:fontsize=${textSize}:x=${position.x}:y=${position.y}`;
          filterComplex += `drawtext=fontfile=/system/fonts/Roboto-Regular.ttf:text=${text}:fontcolor=${colorText}:fontsize=${textSize}:x=${position.x}:y=${position.y}${index !== textOverlayList.length - 1 ? ',' : ''}`;
          overlayMaps += `[v${index}]`;
          textCount++;
        }
      });

      const overlayMap = `[v${textOverlayList.length}]`; // Adjusted to use the correct index

      // Construct the FFmpeg command
      let ffmpegCommand;
      if (imageCount > 0) {
        console.log("ffmpegCommand================================2",)
        // If only image overlays exist
        ffmpegCommand = `-y -i ${localUri} ${textOverlayList.map((overlay, index) => `-i ${overlay.image}`).join(' ')} -filter_complex "${filterComplex}" -map "${overlayMap}" -map 0:a -q:v 4 -q:a 4 -pix_fmt yuv420p -t 6.1 ${downloadDir}/${rand + newFileName}`;
        // ffmpegCommand = `-y -i ${localUri} ${textOverlayList.map((overlay, index) => `-i ${overlay.image}`).join(' ')} -filter_complex "${filterComplex}" -map "${overlayMap}" -map 0:a -q:v 4 -q:a 4 -pix_fmt yuv420p -t 6.1 ${downloadDir}/${rand + newFileName}`;
      } else if (textCount > 0) {
        console.log("ffmpegCommand================================3",)
        // If only text overlays exist
        ffmpegCommand = `-i ${localUri} -filter_complex "${filterComplex}" -codec:a copy -q:v 4 -q:a 4 ${downloadDir}/${newFileName}`;
      } else {
        console.log("ffmpegCommand================================4",)
        // If no overlays exist
        ffmpegCommand = `-y -i ${localUri} -c copy ${downloadDir}/${newFileName}`;
      }

      console.log("ffmpegCommand", ffmpegCommand)
      // Execute FFmpeg command
      await FFmpegKit.executeAsync(ffmpegCommand);

      // Display success message
      console.log(`Video downloaded successfully! Location: ${downloadDir}/${newFileName}`);
    } catch (error) {
      // Log and display error message
      console.error('Error saving video:', error);
      Alert.alert('Failed to download video!');
    }
  };

  const downloadVideoBoth = async () => {
    // Check if video URI exists
    if (!videoUri) {
      Alert.alert('No video to download!');
      return;
    }

    const isPermissionGranted = await checkWriteExternalStoragePermission();
    if (!isPermissionGranted) {
      const permissionGranted = await requestWriteExternalStoragePermission();
      if (!permissionGranted) {
        Alert.alert('Permission denied. Cannot download video.');
        return;
      }
    }

    // Extract file extension and generate new file name
    const localUri = videoUri.replace('file://', '');
    const fileExtension = localUri.split('.').pop();
    const datetime = new Date().toLocaleTimeString().replace(':', '').replace(' ', '');
    const newFileName = `${datetime}overlayed_video.${fileExtension}`;
    // Specify download directory
    const downloadDir = `${RNFS.DownloadDirectoryPath}`;

    try {
      // Check if download directory exists, if not, create it
      const dirExists = await RNFS.exists(downloadDir);
      if (!dirExists) {
        await RNFS.mkdir(downloadDir);
      }

      // Construct FFmpeg filter_complex string with dynamic text overlay filters
      let filterComplex = '';
      let overlayInputs = '';
      let overlayMaps = '';
      let imageCount = 0;
      let textCount = 0;
      const rand = Math.floor(100000 + Math.random() * 900000);

      // First pass: add image overlays
      textOverlayList.forEach((overlay, index) => {
        if (overlay.image) {
          const imagePath = overlay.image;
          const position = overlay.position;
          const overlayInput = `-i ${imagePath}`;
          overlayInputs += overlayInput;

          filterComplex += `${imageCount === 0 && textCount === 0 ? '' : ';'}[${index}:v]scale=200:200[t${index}];${imageCount === 0 && textCount === 0 ? '[0:v]' : `[v${index - 1}]`}[t${index}]overlay=x=${position.x}:y=${position.y}[v${index}]`;
          overlayMaps += `[v${index}]`;
          imageCount++;
        }
      });

      // Second pass: add text overlays
      textOverlayList.forEach((overlay, index) => {
        if (overlay.text) {
          const text = overlay.text;
          const position = overlay.position;

          // Add text overlay filter for each text item
          filterComplex += `${imageCount === 0 && textCount === 0 ? '' : ';'}[${index}:v]drawtext=fontfile=/system/fonts/Roboto-Regular.ttf:text=${text}:fontcolor=${colorText}:fontsize=${textSize}:x=${position.x}:y=${position.y}[v${index}]`;
          overlayMaps += `[v${index}]`;
          textCount++;
        }
      });

      // Construct the FFmpeg command
      let ffmpegCommand;
      if (imageCount > 0 || textCount > 0) {
        // If image or text overlays exist
        ffmpegCommand = `-y -i ${localUri} ${overlayInputs} -filter_complex "${filterComplex}" -map "${overlayMaps}" -map 0:a -q:v 4 -q:a 4 -pix_fmt yuv420p ${downloadDir}/${rand + newFileName}`;
      } else {
        // If no overlays exist
        ffmpegCommand = `-y -i ${localUri} -c copy ${downloadDir}/${rand + newFileName}`;
      }

      console.log("ffmpegCommand", ffmpegCommand)
      // Execute FFmpeg command
      // await FFmpegKit.executeAsync(ffmpegCommand);

      // Display success message
      console.log(`Video downloaded successfully! Location: ${downloadDir}/${newFileName}`);
    } catch (error) {
      // Log and display error message
      console.error('Error saving video:', error);
      Alert.alert('Failed to download video!');
    }
  };

  const downloadVideo = () => {

    let hasImages = false;
    let hasTexts = false;
    textOverlayList.forEach((overlay) => {
      if (overlay.image) {
        hasImages = true;
      } else if (overlay.text) {
        hasTexts = true;
      }
    });

    if (hasImages && hasTexts) {
      downloadVideoBoth();
    } else if (hasImages) {
      downloadVideoONe();
    }
    else if (hasTexts) {
      downloadVideoONe();
    }

  }


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
        setTimeout(() => {
          const outputExists = RNFS.exists(`file://${outputPath}`);
          if (outputExists) {
            // Set the video URI to the output path
            setVideoUri(`file://${outputPath}`);
            // Alert.alert('Audio replaced successfully!');
            Alert.alert('Audio replaced successfully!');
          } else {
            Alert.alert('Failed to replace audio. Output file does not exist.');
          }        // console.log("outputPath", outputPath)
        }, 4000);
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
              <VideoPlayer videoUri={videoUri} ref={videoContainerRef} mute={muteOriginalSound} toggleMuteOriginalSound={toggleMuteOriginalSound} muteOriginalSound={muteOriginalSound} />
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
                    <Text style={[styles.overlayText, { color: colorText, fontSize: textSize }]}>{overlay.text}</Text>
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
            <View style={{ width: "100%", flexDirection: "row", height: 50 }}>
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
            </View>
            <View style={{ width: "100%", flexDirection: "row", height: 50 }}>
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
              {/* {textOverlayList[0]?.image || textOverlayList[0]?.text && ( */}
              <View style={{ flex: 1, alignSelf: "center", justifyContent: "center" }}>
                <TouchableOpacity style={{ backgroundColor: 'gray', margin: 5, padding: 10 }} onPress={downloadVideo}>
                  <Text style={{ textAlign: "center", color: "white", fontSize: 16 }}>
                    Download Video
                  </Text>
                </TouchableOpacity>
              </View>
              {/* )} */}
            </View>

            {textOverlayList[0]?.text && (
              <>
                <View style={{ width: "100%", flexDirection: "row", height: 50, justifyContent: "center", alignItems: "center" }}>
                  <Text>Text color:</Text>
                  <View style={{ flex: 1, alignSelf: "center", justifyContent: "center", alignItems: "center" }}>
                    <TouchableOpacity style={{ backgroundColor: "red", width: 50, height: 50, borderRadius: 100, borderWidth: 2, borderColor: "black" }} onPress={() => setcolorText("red")}></TouchableOpacity>
                  </View>
                  <View style={{ flex: 1, alignSelf: "center", justifyContent: "center", alignItems: "center" }}>
                    <TouchableOpacity style={{ backgroundColor: "green", width: 50, height: 50, borderRadius: 100, borderWidth: 2, borderColor: "black" }} onPress={() => setcolorText("green")}></TouchableOpacity>
                  </View>
                  <View style={{ flex: 1, alignSelf: "center", justifyContent: "center", alignItems: "center" }}>
                    <TouchableOpacity style={{ backgroundColor: "blue", width: 50, height: 50, borderRadius: 100, borderWidth: 2, borderColor: "black" }} onPress={() => setcolorText("blue")}></TouchableOpacity>
                  </View>
                  <View style={{ flex: 1, alignSelf: "center", justifyContent: "center", alignItems: "center" }}>
                    <TouchableOpacity style={{ backgroundColor: "black", width: 50, height: 50, borderRadius: 100, borderWidth: 2, borderColor: "black" }} onPress={() => setcolorText("black")}></TouchableOpacity>
                  </View>
                </View>
                <View style={{ width: "100%", flexDirection: "row", height: 50, justifyContent: "center", alignItems: "center" }}>
                  <Text>Text size :</Text>
                  <View style={{ flex: 1, alignSelf: "center", justifyContent: "center", alignItems: "center" }}>
                    <TouchableOpacity style={{ backgroundColor: "lightgray", width: 50, height: 50, borderRadius: 100, borderWidth: 2, borderColor: "black", justifyContent: "center", alignItems: "center", marginTop: 5 }} onPress={() => setTextSize(16)}>
                      <Text style={{ color: "black", fontSize: 16 }}>16</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{ flex: 1, alignSelf: "center", justifyContent: "center", alignItems: "center" }}>
                    <TouchableOpacity style={{ backgroundColor: "lightgray", width: 50, height: 50, borderRadius: 100, borderWidth: 2, borderColor: "black", justifyContent: "center", alignItems: "center", marginTop: 5 }} onPress={() => setTextSize(18)}>
                      <Text style={{ color: "black", fontSize: 16 }}>18</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{ flex: 1, alignSelf: "center", justifyContent: "center", alignItems: "center" }}>
                    <TouchableOpacity style={{ backgroundColor: "lightgray", width: 50, height: 50, borderRadius: 100, borderWidth: 2, borderColor: "black", justifyContent: "center", alignItems: "center", marginTop: 5 }} onPress={() => setTextSize(20)}>
                      <Text style={{ color: "black", fontSize: 16 }}>20</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{ flex: 1, alignSelf: "center", justifyContent: "center", alignItems: "center" }}>
                    <TouchableOpacity style={{ backgroundColor: "lightgray", width: 50, height: 50, borderRadius: 100, borderWidth: 2, borderColor: "black", justifyContent: "center", alignItems: "center", marginTop: 5 }} onPress={() => setTextSize(24)}>
                      <Text style={{ color: "black", fontSize: 16 }}>24</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}
          </View>
        ) : (
          check === 0 && (<View style={{ flex: 1, justifyContent: "center", alignContent: "center", }}>
            <Button title="Select Video" onPress={selectVideoFromLibrary} />
            <View style={{ paddingVertical: 10 }}></View>
            {/* <Button title="Select Image" onPress={() => { }} /> */}
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

      {progress > 0 && progress < 99 && (<View style={{ backgroundColor: "rgba(0,0,0,0.5)", flex: 1, position: "absolute", zIndex: 999, width: "100%", height: "100%", justifyContent: "center", alignItems: "center" }}>
        <Text style={{ fontSize: 22, color: 'red', textAlign: 'center', backgroundColor: "white", padding: 20, borderRadius: 10, width: "80%" }}>Downloading video - {(progress)?.toFixed(2)}%</Text>
      </View>)}

    </View>
  );
};

const VideoPlayer = forwardRef(({ videoUri, mute, toggleMuteOriginalSound, muteOriginalSound }, ref) => {
  return (
    <View style={{ flex: 1 }} ref={ref}>
      <Video
        source={{ uri: videoUri }}
        style={{ width: "100%", height: 600, backgroundColor: "black" }}
        resizeMode="contain"
        controls={true}
        muted={mute}
      />

      {videoUri && (
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', position: "absolute", zIndex: 999, backgroundColor: 'white', bottom: 10, right: 10, padding: 5 }}>
          <TouchableOpacity onPress={toggleMuteOriginalSound}>
            {/* <Text style={{ color: 'blue' }}>{muteOriginalSound ? 'Unmute' : 'Mute'} Original Sound</Text> */}
            {muteOriginalSound ? <Image
              source={{ uri: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Mute_Icon.svg/480px-Mute_Icon.svg.png" }}
              style={{ width: 30, height: 30 }} resizeMode='contain'
            />
              :
              <Image
                source={{ uri: "https://static-00.iconduck.com/assets.00/unmute-icon-512x385-1tlusav6.png" }}
                style={{ width: 30, height: 30 }} resizeMode='contain'
              />}
          </TouchableOpacity>
        </View>
      )}
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
    // backgroundColor: "red",
    padding: 5
  },
  overlayText: {
    fontSize: 25,
    fontWeight: 'bold',
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
