import React, { useState, useRef, useEffect, forwardRef } from 'react';
import { View, Text, Button, TouchableOpacity, StyleSheet, TextInput, Modal, PanResponder, Image, NativeEventEmitter, NativeModules, Alert, PermissionsAndroid, ScrollView, Dimensions } from 'react-native';
import { RNCamera } from 'react-native-camera';
import Video from 'react-native-video';
import { showEditor } from 'react-native-video-trim';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import RNFS from 'react-native-fs';
import DocumentPicker from 'react-native-document-picker';
import { FFmpegKit, ReturnCode } from 'ffmpeg-kit-react-native';
import FFmpegWrapper from './FFmpegWrapper';

const SCREEN_WIDTH = Dimensions.get('screen').width;
const SCREEN_HEIGHT = Dimensions.get('screen').height;
export const FRAME_PER_SEC = 1;
export const FRAME_WIDTH = 80;
const TILE_HEIGHT = 80;
const TILE_WIDTH = FRAME_WIDTH / 2; // to get a 2x resolution

const DURATION_WINDOW_DURATION = 4;
const DURATION_WINDOW_BORDER_WIDTH = 4;
const DURATION_WINDOW_WIDTH =
  DURATION_WINDOW_DURATION * FRAME_PER_SEC * TILE_WIDTH;
const POPLINE_POSITION = '50%';

const FRAME_STATUS = Object.freeze({
  LOADING: { name: Symbol('LOADING') },
  READY: { name: Symbol('READY') },
});

const App = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedSeconds, setRecordedSeconds] = useState(0);
  const cameraRef = useRef(null);
  const [videoUri, setVideoUri] = useState(null);
  const [isAddingText, setIsAddingText] = useState(false);
  const [textOverlayList, setTextOverlayList] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [muteOriginalSound, setMuteOriginalSound] = useState(false); // State to track muting original sound
  const [externalAudioUri, setExternalAudioUri] = useState(null);
  const [check, setCheck] = useState(0)
  const [colorText, setcolorText] = useState('white');
  const [textSize, setTextSize] = useState(16);

  const [secondVideo, setsecondVideo] = useState(null);

  const videoContainerRef = useRef(null);
  const videoPlayerRef = useRef();

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


  const addVideoOverVideo = () => {
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
        setTextOverlayList([...textOverlayList, { video: selectedVideoUri, position: { x: 20, y: 20 } }]);

        setTimeout(() => {
          setsecondVideo(selectedVideoUri)
        }, 2000);
        // Merge the selected video with the current video
      }
    });
  }

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

      Timer('Video Merged Successfully!')
      // Execute FFmpeg command
      await FFmpegKit.executeAsync(command);

      setTimeout(() => {
        setVideoUri(`file://${mergedVideoPath}`);

      }, 4000);

      const mergedVideoDuration = await new Promise((resolve, reject) => {
        videoPlayerRef.current.seek(0);
        videoPlayerRef.current.setOnSeekCompleteCallback(() => {
          const duration = videoPlayerRef.current.getDuration();
          resolve(duration);
        });
      });
      // Set the videoUri state to the URI of the merged video
      setTimeout(() => {
        handleVideoLoad(mergedVideoDuration)
      }, 5000);

      // Display success message
      console.log('Videos merged successfully!');
    } catch (error) {
      // Log and display error message
      console.error('Error merging videos:', error);
      Alert.alert('Failed to merge videos!');
    }
  };


  const [progress, setProgress] = useState(0);

  const Timer = (mxg) => {
    const totalTime = 10000; // 10 seconds in milliseconds
    let currentTime = 0;

    const timer = setInterval(() => {
      currentTime += 100;
      const newProgress = (currentTime / totalTime) * 100;
      setProgress(newProgress);

      if (currentTime >= totalTime) {
        Alert.alert(mxg)
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
      Timer("Video Downloaded!")
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

      // Construct FFmpeg filter_complex string with dynamic text and image overlay filters
      let filterComplex = '';
      let overlayInputs = '';
      let imageCount = 0;
      let textCount = 0;
      let countss = 1;
      const rand = Math.floor(100000 + Math.random() * 900000);

      const textOverlays = textOverlayList.filter(overlay => overlay.text);
      const imageOverlays = textOverlayList.filter(overlay => overlay.image);

      let textFilterComplex = '';
      textOverlays.forEach((overlay, index) => {
        const text = overlay.text;
        const position = overlay.position;

        textFilterComplex += `drawtext=fontfile=/system/fonts/Roboto-Regular.ttf:text=${text}:fontcolor=${colorText}:fontsize=${textSize}:x=${position.x}:y=${position.y}${index < textOverlays.length - 1 ? ',' : ''}`;
        // countss++;
        textCount++;
      });

      let imageFilterComplex = '';
      let imageFilterComplex2 = '';
      imageOverlays.forEach((overlay, index) => {
        const imagePath = overlay.image;
        const position = overlay.position;
        const overlayInput = `-i ${imagePath} `;
        overlayInputs += overlayInput;

        imageFilterComplex += `[${countss}:v]scale=100:100[ovrl${countss}];`;
        imageFilterComplex2 += `${countss == 1 ? `[${countss - 1}:v]` : `[v${countss - 1}]`}[ovrl${countss}]overlay=x=${position.x}:y=${position.y}${index < imageOverlays.length - 1 ? `[v${countss}]` : ''}${index < imageOverlays.length - 1 ? ';' : ','}`;
        countss++;
        imageCount++;
      });

      // Construct the FFmpeg command
      // ffmpegCommand = `-y -i ${localUri} -i ${textOverlayList[0]?.image} -i ${textOverlayList[1]?.image} -i ${textOverlayList[2]?.image} -filter_complex "[1:v]scale=100:100[ovrl1];[2:v]scale=100:100[ovrl2];[0:v][ovrl1]overlay=x=10:y=10[bg];[bg][ovrl2]overlay=x=80:y=80,drawtext=fontfile=/system/fonts/Roboto-Regular.ttf:text='First Text Overlay':fontcolor=white:fontsize=24:box=1:boxcolor=black@0.5:boxborderw=5:x=(w-text_w)/2:y=(h-text_h)/2,drawtext=fontfile=/system/fonts/Roboto-Regular.ttf:text='Second Text Overlay':fontcolor=white:fontsize=50:box=1:boxcolor=black@0.5:boxborderw=5:x=(w-text_w)/2:y=(h-text_h)/3,drawtext=fontfile=/system/fonts/Roboto-Regular.ttf:text='Third Text Overlay':fontcolor=white:fontsize=50:box=1:boxcolor=black@0.5:boxborderw=5:x=(w-text_w)/3:y=(h-text_h)/3" -map 0:a -q:v 4 -q:a 4 -pix_fmt yuv420p ${downloadDir}/${rand + newFileName}`;
      let ffmpegCommand = `-y -i ${localUri} ${overlayInputs} -filter_complex "${imageFilterComplex}${imageFilterComplex2}${textFilterComplex}" -map 0:a -q:v 4 -q:a 4 -pix_fmt yuv420p ${downloadDir}/${rand + newFileName}`;
      // ffmpegCommand = `-y -i ${localUri} -i ${textOverlayList[0]?.image} -i ${textOverlayList[1]?.image} -i ${textOverlayList[2]?.image} -filter_complex "[1:v]scale=100:100[ovrl1];[2:v]scale=100:100[ovrl2];[3:v]scale=100:100[ovrl3];[0:v][ovrl1]overlay=x=10:y=10[bg1];[bg1][ovrl2]overlay=x=80:y=80[bg2];[bg2][ovrl3]overlay=x=150:y=150,drawtext=fontfile=/system/fonts/Roboto-Regular.ttf:text='First Text Overlay':fontcolor=white:fontsize=24:box=1:boxcolor=black@0.5:boxborderw=5:x=(w-text_w)/2:y=(h-text_h)/2,drawtext=fontfile=/system/fonts/Roboto-Regular.ttf:text='Second Text Overlay':fontcolor=white:fontsize=50:box=1:boxcolor=black@0.5:boxborderw=5:x=(w-text_w)/2:y=(h-text_h)/3,drawtext=fontfile=/system/fonts/Roboto-Regular.ttf:text='Third Text Overlay':fontcolor=white:fontsize=50:box=1:boxcolor=black@0.5:boxborderw=5:x=(w-text_w)/3:y=(h-text_h)/3" -map 0:a -q:v 4 -q:a 4 -pix_fmt yuv420p ${downloadDir}/${rand + newFileName}`;

      // Execute FFmpeg command
      Timer("Video Downloaded!")

      console.log("ffmpegCommand==============", ffmpegCommand);
      await FFmpegKit.executeAsync(ffmpegCommand);

      // Display success message
      console.log(`Video downloaded successfully! Location: ${downloadDir}/${newFileName}`);
    } catch (error) {
      // Log and display error message
      console.error('Error saving video:', error);
      Alert.alert('Failed to download video!');
    }
  };


  const downloadVideowithVideo = async () => {
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
    const downloadDir = `${RNFS.DownloadDirectoryPath}`;

    try {
      const dirExists = await RNFS.exists(downloadDir);
      if (!dirExists) {
        await RNFS.mkdir(downloadDir);
      }

      const rand = Math.floor(100000 + Math.random() * 900000);
      let filterComplex = ''; // Initialize filterComplex

      // Add scaling and overlay for each overlay video
      filterComplex += `[0:v]scale=1920x2500,setsar=1:1[v0];`; // Scale base video
      let baseIndex1 = 1;
      let baseIndex = 1;

      textOverlayList.forEach((overlay, index) => {
        filterComplex += `[${baseIndex}:v]scale=640:640[v${baseIndex}];`; // Scale overlay video
        baseIndex++
      });

      textOverlayList.forEach((overlay, index) => {
        const position = overlay.position;

        filterComplex += `[v${baseIndex1 === 1 ? baseIndex1 - 1 : baseIndex1 + 1}][v${baseIndex1}]overlay=x=${position.x}:y=${position.y}[v${baseIndex1 === 1 ? baseIndex1 + 2 : baseIndex1 + 2}];`; // Overlay with position
        baseIndex1++
      });

      // Remove trailing semicolon
      filterComplex = filterComplex.slice(0, -1);

      // let ffmpegCommand = `-i ${localUri} -i ${secondVideo} -filter_complex "[0:v]scale=1920x2300,setsar=1:1[v0];[1:v]scale=640:640[v1];[v0][v1]overlay=10:10" -c:a copy -c:v mpeg4 -crf 23 -preset veryfast ${downloadDir}/${rand + newFileName}`


      let ffmpegCommand = `-i ${localUri} `;

      // Add input for each overlay video
      textOverlayList.forEach((overlay, index) => {
        ffmpegCommand += `-i ${overlay.video} `;
      });

      ffmpegCommand += `-filter_complex "${filterComplex}" -map "[v${baseIndex + 1}]" -c:a copy -c:v mpeg4 -crf 23 -preset veryfast ${downloadDir}/${rand + newFileName}`;

      // Execute FFmpeg command
      console.log("========================", ffmpegCommand)
      await FFmpegKit.executeAsync(ffmpegCommand);
      // Display success message
      console.log(`Video downloaded successfully! Location: ${downloadDir}/${newFileName}`);
    } catch (error) {
      // Log and display error message
      console.error('Error saving video:', error);
      Alert.alert('Failed to download video!');
    }
  }

  const downloadVideoWithAllOverlays = async () => {
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

      // Construct FFmpeg filter_complex string with dynamic text and image overlay filters
      let filterComplex = '';
      let filterComplexVideo = '';
      let filterComplexText = '';
      let overlayInputs = '';
      let overlayMap = '';
      let countss = 1;
      let countss2 = 1;
      const rand = Math.floor(100000 + Math.random() * 900000);

      // Loop through each overlay in textOverlayList
      textOverlayList.forEach((overlay, index) => {
        if (overlay.image || overlay.video) {
          const imagePath = overlay.image;
          const position = overlay.position;
          const overlayInput = `-i ${imagePath} `;
          overlayInputs += overlayInput;

          filterComplex += `[${countss}:v]scale=200:200[ovrl${countss}];`;
          countss++;
        }
      });

      textOverlayList.forEach((overlay, index) => {
        if (overlay.image || overlay.video) {
          const videoPath = overlay.video;
          const position1 = overlay.position;
          const overlayInput1 = `-i ${videoPath} `;
          overlayInputs += overlayInput1;

          filterComplexVideo += `${countss2 == 1 ? `[0:v]` : `[ovrl${countss}]`}[ovrl${countss2}]overlay=x=${position1.x}:y=${position1.y}${index !== textOverlayList.length - 1 ? `[ovrl${countss + 1}]` : ''}${index !== textOverlayList.length - 1 ? ';' : ','}`;
          countss2++;
          countss++;
        }

      });


      textOverlayList.forEach((overlay, index) => {
        if (overlay.text) {

          const text = overlay.text;
          const position2 = overlay.position;

          filterComplexText += `drawtext=fontfile=/system/fonts/Roboto-Regular.ttf:text=${text}:fontcolor=red:fontsize=24:x=${position2.x}:y=${position2.y}${index !== textOverlayList.length - 1 ? ',' : ''}`;
        }
      });

      filterComplexText = filterComplexText.slice(0, filterComplexText.length - 1)

      // Construct the FFmpeg command
      const ffmpegCommand = `-y -i ${localUri} ${textOverlayList.map((overlay, index) => overlay.image && `-i ${overlay.image}`).join(' ')}  ${textOverlayList.map((overlay, index) => overlay.video && `-i ${overlay.video}`).join(' ')} -filter_complex "${filterComplex}${filterComplexVideo}${filterComplexText}" -map 0:a -q:v 4 -q:a 4 -pix_fmt yuv420p ${downloadDir}/${rand + newFileName}`;

      // Execute FFmpeg command
      Timer("Video Downloaded!")

      await FFmpegKit.executeAsync(ffmpegCommand);
      console.log("ffmpegCommand=====================", ffmpegCommand)
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
    let hasVideo = false;
    textOverlayList.forEach((overlay) => {
      if (overlay.image) {
        hasImages = true;
      } else if (overlay.text) {
        hasTexts = true;
      }
      else if (overlay.video) {
        hasVideo = true;
      }
    });

    if (hasImages && hasTexts) {
      console.log("first----------------------------", 1)
      downloadVideoBoth();
    } else if (hasImages) {
      console.log("first----------------------------", 2)
      downloadVideoONe();
    }
    else if (hasTexts) {
      console.log("first----------------------------", 3)
      downloadVideoONe();
    }
    else if (hasVideo) {
      console.log("first----------------------------", 4)
      downloadVideowithVideo();
    } else {
      console.log("first----------------------------", 5)

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

        Timer('Audio replaced successfully!')
        await FFmpegKit.executeAsync(ffmpegCommand);

        setTimeout(() => {
          const outputExists = RNFS.exists(`file://${outputPath}`);
          if (outputExists) {
            // Set the video URI to the output path
            setVideoUri(`file://${outputPath}`);
            // Alert.alert('Audio replaced successfully!');
            // Alert.alert('Audio replaced successfully!');
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

  const [frames, setFrames] = useState(); // <[{status: <FRAME_STATUS>}]>
  const [framesLineOffset, setFramesLineOffset] = useState(0); // number
  const [paused, setPaused] = useState(false);

  const getFileNameFromPath = path => {
    const fragments = path.split('/');
    let fileName = fragments[fragments.length - 1];
    fileName = fileName.split('.')[0];
    return fileName;
  };

  const handleVideoLoad = videoAssetLoaded => {
    const numberOfFrames = Math.ceil(videoAssetLoaded.duration);
    setFrames(
      Array(numberOfFrames).fill({
        status: FRAME_STATUS.LOADING.name.description,
      }),
    );

    FFmpegWrapper.getFrames(
      getFileNameFromPath(videoUri),
      videoUri,
      numberOfFrames,
      filePath => {
        const _framesURI = [];
        for (let i = 0; i < numberOfFrames; i++) {
          _framesURI.push(
            `${filePath.replace('%4d', String(i + 1).padStart(4, 0))}`,
          );
        }
        const _frames = _framesURI.map(_frameURI => ({
          uri: _frameURI,
          status: FRAME_STATUS.READY.name.description,
        }));
        setFrames(_frames);
      },
    );
  };

  const renderFrame = (frame, index) => {
    if (frame.status === FRAME_STATUS.LOADING.name.description) {
      return <View style={styles.loadingFrame} key={index} />;
    } else {
      return (
        <Image
          key={index}
          source={{ uri: 'file://' + frame.uri }}
          style={{
            width: TILE_WIDTH,
            height: TILE_HEIGHT,
          }}
          onLoad={() => {
            console.log('Image loaded');
          }}
        />
      );
    }
  };

  const getPopLinePlayTime = offset => {
    return (
      (offset + (DURATION_WINDOW_WIDTH * parseFloat(POPLINE_POSITION)) / 100) /
      (FRAME_PER_SEC * TILE_WIDTH)
    );
  };

  const handleOnScroll = ({ nativeEvent }) => {
    const playbackTime = getPopLinePlayTime(nativeEvent.contentOffset.x);
    videoPlayerRef.current?.seek(playbackTime);
    setFramesLineOffset(nativeEvent.contentOffset.x);
  };

  const getLeftLinePlayTime = offset => {
    return offset / (FRAME_PER_SEC * TILE_WIDTH);
  };
  const getRightLinePlayTime = offset => {
    return (offset + DURATION_WINDOW_WIDTH) / (FRAME_PER_SEC * TILE_WIDTH);
  };

  const handleOnProgress = ({ currentTime }) => {
    if (currentTime >= getRightLinePlayTime(framesLineOffset)) {
      videoPlayerRef.current.seek(getLeftLinePlayTime(framesLineOffset));
    }
  };

  const handleOnTouchEnd = () => {
    setPaused(false);
  };
  const handleOnTouchStart = () => {
    setPaused(true);
  };


  const [filter, setFilter] = useState(''); // Current filter

  const applyFilter = async (selectedFilter) => {
    try {


      const isPermissionGranted = await checkWriteExternalStoragePermission();
      if (!isPermissionGranted) {
        const permissionGranted = await requestWriteExternalStoragePermission();
        if (!permissionGranted) {
          Alert.alert('Permission denied. Cannot download video.');
          return;
        }
      }

      // Ensure video URI exists
      if (!videoUri) {
        Alert.alert('No video to filter!');
        return;
      }
      const downloadDir = `${RNFS.CachesDirectoryPath}`;

      // Create a random output file name
      const outputFileName = `filtered_video_${Date.now()}.mp4`;

      // Construct FFmpeg command to apply the selected filter
      const ffmpegCommand = `-i ${videoUri} -vf ${selectedFilter} -map 0:a -q:v 4 -q:a 4 -pix_fmt yuv420p ${downloadDir}/${outputFileName}`;

      // Execute FFmpeg command
      await FFmpegKit.executeAsync(ffmpegCommand);

      // Set the filtered video URI
      setTimeout(() => {
        setVideoUri(`${downloadDir}/${outputFileName}`);
      }, 5000);
      setFilter(selectedFilter);
    } catch (error) {
      console.error('Error applying filter:', error);
      Alert.alert('Failed to apply filter!');
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        {videoUri ? (
          <View style={{ flex: 1 }}>
            <View style={{ height: 600 }}>
              <VideoPlayer videoUri={videoUri} ref={videoContainerRef} mute={muteOriginalSound} toggleMuteOriginalSound={toggleMuteOriginalSound} muteOriginalSound={muteOriginalSound}
                trimVideo={trimVideo}
                videoPlayerRef={videoPlayerRef}
                handleAddText={handleAddText}
                handleAddImage={handleAddImage}
                // addVideoOnVideo={addVideoOnVideo}
                addVideoOnVideo={addVideoOverVideo}
                externalAudioUri={externalAudioUri}
                replaceVideoAudio={replaceVideoAudio}
                addExternalAudio={addExternalAudio}
                handleVideoLoad={handleVideoLoad}
                handleOnProgress={handleOnProgress}
              />


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
                    <Text style={[styles.overlayText, { color: colorText, fontSize: textSize }]}>{overlay.text}</Text>
                  )}
                  {overlay.image && (
                    <Image source={{ uri: overlay.image }} style={{ width: 150, height: 150 }} />
                  )}
                  {overlay.video && (
                    <Video source={{ uri: overlay.video }}
                      style={{ width: 150, height: 150 }}
                      resizeMode="cover"
                      mute={true}
                      controls={false}
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
                </View>
              ))}
            </View>



            <View style={{ width: "100%", flexDirection: "row", height: 50 }}>
              <View style={{ flex: 1, alignSelf: "center", justifyContent: "center" }}>
                <TouchableOpacity style={{ backgroundColor: 'gray', margin: 5, padding: 10 }} onPress={downloadVideoWithAllOverlays}>
                  <Text style={{ textAlign: "center", color: "white", fontSize: 16 }}>
                    Download Video
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* <View style={{ width: '100%', flexDirection: "row", justifyContent: "space-between" }}>
              <TouchableOpacity onPress={() => applyFilter('negate')} style={{ width: 50, height: 50, backgroundColor: "green" }}><Text style={{ fontSize: 16, color: "red" }}>Negate</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => applyFilter('vflip')} style={{ width: 50, height: 50, backgroundColor: "green" }}><Text style={{ fontSize: 16, color: "red" }}>VFlip</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => applyFilter('hflip')} style={{ width: 50, height: 50, backgroundColor: "green" }}><Text style={{ fontSize: 16, color: "red" }}>HFlip</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => applyFilter('transpose=clock')} style={{ width: 50, height: 50, backgroundColor: "green" }}><Text style={{ fontSize: 16, color: "red" }}>Rotate Clockwise</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => applyFilter('transpose=cclock')} style={{ width: 50, height: 50, backgroundColor: "green" }}><Text style={{ fontSize: 16, color: "red" }}>Rotate Counterclockwise</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => applyFilter('transpose=clock_flip')} style={{ width: 50, height: 50, backgroundColor: "green" }}><Text style={{ fontSize: 16, color: "red" }}>Rotate & Flip Clockwise</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => applyFilter('transpose=cclock_flip')} style={{ width: 50, height: 50, backgroundColor: "green" }}><Text style={{ fontSize: 16, color: "red" }}>Rotate & Flip Counterclockwise</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => applyFilter('fade=in:0:30')} style={{ width: 50, height: 50, backgroundColor: "green" }}><Text style={{ fontSize: 16, color: "red" }}>Fade In</Text></TouchableOpacity>
            </View>
            <View style={{ width: '100%', flexDirection: "row", justifyContent: "space-between" }}>
              <TouchableOpacity onPress={() => applyFilter('fade=out:100:30')} style={{ width: 50, height: 50, backgroundColor: "green" }}><Text style={{ fontSize: 16, color: "red" }}>Fade Out</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => applyFilter('crop=w=100:h=100:x=0:y=0')} style={{ width: 50, height: 50, backgroundColor: "green" }}><Text style={{ fontSize: 16, color: "red" }}>Crop</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => applyFilter('scale=w=640:h=360')} style={{ width: 50, height: 50, backgroundColor: "green" }}><Text style={{ fontSize: 16, color: "red" }}>Scale</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => applyFilter('boxblur=5:1')} style={{ width: 50, height: 50, backgroundColor: "green" }}><Text style={{ fontSize: 16, color: "red" }}>Box Blur</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => applyFilter('hue=s=0')} style={{ width: 50, height: 50, backgroundColor: "green" }}><Text style={{ fontSize: 16, color: "red" }}>Hue</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => applyFilter('saturation=s=2')} style={{ width: 50, height: 50, backgroundColor: "green" }}><Text style={{ fontSize: 16, color: "red" }}>Saturation</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => applyFilter('drawtext=text=\'Hello World\'')} style={{ width: 50, height: 50, backgroundColor: "green" }}><Text style={{ fontSize: 16, color: "red" }}>Draw Text</Text></TouchableOpacity>
            </View> */}


            {/* {frames && (
              <View style={styles.durationWindowAndFramesLineContainer}>
                <View style={styles.durationWindow}>
                  <View style={styles.durationLabelContainer}>
                    <Text style={styles.durationLabel}>
                      {DURATION_WINDOW_DURATION} sec .
                    </Text>
                  </View>
                </View>
                <View style={styles.popLineContainer}>
                  <View style={styles.popLine} />
                </View>
                <View style={styles.durationWindowLeftBorder} />
                <View style={styles.durationWindowRightBorder} />
                <ScrollView
                  onScroll={handleOnScroll}
                  showsHorizontalScrollIndicator={false}
                  horizontal={true}
                  style={styles.framesLine}
                  alwaysBounceHorizontal={true}
                  scrollEventThrottle={1}
                  onTouchStart={handleOnTouchStart}
                  onTouchEnd={handleOnTouchEnd}
                  onMomentumScrollEnd={handleOnTouchEnd}
                >
                  <View style={styles.prependFrame} />
                  {frames.map((frame, index) => renderFrame(frame, index))}
                  <View style={styles.appendFrame} />
                  <TouchableOpacity onPress={addVideoOnVideo} style={{ width: 80, height: 80, justifyContent: "center", alignItems: "center" }}>
                    <Image
                      source={{ uri: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSenNhboidQCgRv-9bJAl-wA5H_6M8EiQZqNOWYlr_IbQ&s" }}
                      style={{ width: 50, height: 50 }}
                      resizeMode='contain'
                    />
                  </TouchableOpacity>
                </ScrollView>
              </View>
            )} */}


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
          check === 0 && (
            <>
              <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                <Text style={{ fontSize: 20, color: "black", fontWeight: 800 }}>Welcome to 12ee Video Editor App </Text>
              </View>

              <View style={{ flex: 3, justifyContent: "center", alignContent: "center", flexDirection: "row", alignItems: "center" }}>
                <TouchableOpacity style={{ flex: 1, width: "100%", height: 100, justifyContent: "center", alignItems: "center" }} onPress={selectVideoFromLibrary}>
                  <Image source={{ uri: 'https://static.thenounproject.com/png/1425326-200.png' }} resizeMode='contain' style={{ width: 100, height: 100 }} />
                  <Text style={{ fontSize: 20, color: "black" }}>Select Video</Text>
                </TouchableOpacity>

                <View style={{ paddingVertical: 10 }}></View>
                <View style={{ paddingVertical: 10 }}></View>
                <TouchableOpacity style={{ flex: 1, width: "100%", height: 100, justifyContent: "center", alignItems: "center" }} onPress={recordvideo}>
                  <Image source={{ uri: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQazmivuQhs1BJsOI5sLWQ3yIvbn6LMOUukwWg5Go8cmw&s' }} resizeMode='contain' style={{ width: 100, height: 100 }} />
                  <Text style={{ fontSize: 20, color: "black" }}>Record Video</Text>
                </TouchableOpacity>
              </View>
            </>
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

const VideoPlayer = forwardRef(({ videoUri, mute, toggleMuteOriginalSound, muteOriginalSound, trimVideo, handleAddText, handleAddImage, addVideoOnVideo, handleOnProgress, externalAudioUri, replaceVideoAudio, addExternalAudio, handleVideoLoad, videoPlayerRef }, ref) => {
  return (
    <View style={{ flex: 1 }} ref={ref}>
      <Video
        source={{ uri: videoUri }}
        style={{ width: "100%", height: 600, backgroundColor: "black" }}
        ref={videoPlayerRef}
        resizeMode="contain"
        controls={true}
        muted={mute}
        onLoad={handleVideoLoad}
        onProgress={handleOnProgress}
      />

      <View style={{ flexDirection: 'column', justifyContent: 'center', alignItems: 'center', position: "absolute", zIndex: 999, top: 10, right: 10, padding: 5 }}>
        <TouchableOpacity onPress={trimVideo} style={{ backgroundColor: "white", width: 50, height: 50, justifyContent: "center", alignItems: "center", marginTop: 10 }}>
          <Image
            source={{ uri: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSY0bNuRpWzRG-B_3lhns55Nh-W4VXkWlO8kQPuBMH41Q&s" }}
            style={{ width: 40, height: 40 }} resizeMode='contain'
          />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleAddText} style={{ backgroundColor: "white", width: 50, height: 50, justifyContent: "center", alignItems: "center", marginTop: 10 }}>
          <Image
            source={{ uri: "https://cdn-icons-png.flaticon.com/512/5304/5304238.png" }}
            style={{ width: 40, height: 40, }} resizeMode='contain'
          />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleAddImage} style={{ backgroundColor: "white", width: 50, height: 50, justifyContent: "center", alignItems: "center", marginTop: 10 }}>
          <Image
            source={{ uri: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRwlVPoCclWj0LPLQOx4QgSmvoJnRp6XsThgX7-Y5Mixg&s" }}
            style={{ width: 40, height: 40, }} resizeMode='contain'
          />
        </TouchableOpacity>
        <TouchableOpacity onPress={addVideoOnVideo} style={{ backgroundColor: "white", width: 50, height: 50, justifyContent: "center", alignItems: "center", marginTop: 10 }}>
          <Image
            source={{ uri: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSenNhboidQCgRv-9bJAl-wA5H_6M8EiQZqNOWYlr_IbQ&s" }}
            style={{ width: 50, height: 50, }} resizeMode='contain'
          />
        </TouchableOpacity>
        <TouchableOpacity onPress={externalAudioUri ? replaceVideoAudio : addExternalAudio} style={{ backgroundColor: "white", width: 50, height: 50, justifyContent: "center", alignItems: "center", marginTop: 10 }}>
          <Image
            source={{ uri: "https://cdn4.iconfinder.com/data/icons/audio-ui/24/_add-512.png" }}
            style={{ width: 50, height: 50, }} resizeMode='contain'
          />
        </TouchableOpacity>
      </View>

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
  framesLine: {
    width: SCREEN_WIDTH,
    // backgroundColor: "red",
    // height: 50
  },
  loadingFrame: {
    width: TILE_WIDTH,
    height: TILE_HEIGHT,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderColor: 'rgba(0,0,0,0.1)',
    borderWidth: 1,
  },
  durationWindowAndFramesLineContainer: {
    top: -DURATION_WINDOW_BORDER_WIDTH,
    width: SCREEN_WIDTH,
    height: TILE_HEIGHT + DURATION_WINDOW_BORDER_WIDTH * 2,
    justifyContent: 'center',
    zIndex: 10,
    backgroundColor: "lightgray",
    marginTop: 20
  },
  durationWindow: {
    width: DURATION_WINDOW_WIDTH,
    borderColor: 'yellow',
    borderWidth: DURATION_WINDOW_BORDER_WIDTH,
    borderRadius: 4,
    height: TILE_HEIGHT + DURATION_WINDOW_BORDER_WIDTH * 2,
    alignSelf: 'center',
  },
  durationLabelContainer: {
    backgroundColor: 'yellow',
    alignSelf: 'center',
    top: -26,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  durationLabel: {
    color: 'rgba(0,0,0,0.6)',
    fontWeight: '700',
  },
  popLineContainer: {
    position: 'absolute',
    alignSelf: POPLINE_POSITION === '50%' && 'center',
    zIndex: 25,
  },
  popLine: {
    width: 3,
    height: TILE_HEIGHT,
    backgroundColor: 'yellow',
  },
  durationWindowLeftBorder: {
    position: 'absolute',
    width: DURATION_WINDOW_BORDER_WIDTH,
    alignSelf: 'center',
    height: TILE_HEIGHT + DURATION_WINDOW_BORDER_WIDTH * 2,
    left: SCREEN_WIDTH / 2 - DURATION_WINDOW_WIDTH / 2,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    backgroundColor: 'yellow',
    zIndex: 25,
  },
  durationWindowRightBorder: {
    position: 'absolute',
    width: DURATION_WINDOW_BORDER_WIDTH,
    right: SCREEN_WIDTH - SCREEN_WIDTH / 2 - DURATION_WINDOW_WIDTH / 2,
    height: TILE_HEIGHT + DURATION_WINDOW_BORDER_WIDTH * 2,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    backgroundColor: 'yellow',
    zIndex: 25,
  },
  framesLine: {
    width: SCREEN_WIDTH,
    position: 'absolute',
  },
  loadingFrame: {
    width: TILE_WIDTH,
    height: TILE_HEIGHT,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderColor: 'rgba(0,0,0,0.1)',
    borderWidth: 1,
  },
  prependFrame: {
    width: SCREEN_WIDTH / 2 - DURATION_WINDOW_WIDTH / 2,
  },
  appendFrame: {
    width: SCREEN_WIDTH / 2 - DURATION_WINDOW_WIDTH / 2,
  },
});

export default App;
