import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Switch,
  Alert,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Linking from 'expo-linking';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import * as MediaLibrary from 'expo-media-library';
import { router } from 'expo-router';
import { useContacts } from '@/contexts/ContactsContext';

const APP_VERSION = '1.0.0';  // Replace with your app version

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
  initialData: {
    full_name: string;
    avatar_url: string;
  };
}

export default function SettingsScreen() {
  const { user: authUser, signOut } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const { refreshContacts } = useContacts();
  
  const [voiceCommandsEnabled, setVoiceCommandsEnabled] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [voiceSpeed, setVoiceSpeed] = useState(1);
  const [voiceType, setVoiceType] = useState('female');
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [isAppLockEnabled, setIsAppLockEnabled] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [profileData, setProfileData] = useState({
    full_name: '',
    avatar_url: '',
  });
  const [showAuthMessage, setShowAuthMessage] = useState(!biometricEnabled);
  const [newImage, setNewImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  useEffect(() => {
    checkBiometricSupport();
    setShowAuthMessage(!biometricEnabled);
    fetchProfile();
  }, [biometricEnabled]);

  const checkBiometricSupport = async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    setIsBiometricSupported(compatible);
  };

  const handleBiometricToggle = async () => {
    if (!isBiometricSupported) {
      Alert.alert('Not Supported', 'Biometric authentication is not supported on this device');
      return;
    }

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to enable biometric login',
      });

      if (result.success) {
        setBiometricEnabled(prev => !prev);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to authenticate');
    }
  };

  const authenticate = async () => {
    if (isBiometricSupported && biometricEnabled) {
      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Authenticate to continue',
          disableDeviceFallback: true,
        });

        if (result.success) {
          return true;
        }
      } catch (error) {
        console.log('Biometric auth failed, falling back to password');
      }
    }

    // Password authentication
    return new Promise((resolve) => {
      Alert.prompt(
        'Enter Password',
        'Please enter your login password to continue',
        [
          {
            text: 'Cancel',
            onPress: () => resolve(false),
            style: 'cancel',
          },
          {
            text: 'Verify',
            onPress: async (password) => {
              if (!password) {
                Alert.alert('Error', 'Password is required');
                resolve(false);
                return;
              }

              try {
                const { error } = await supabase.auth.signInWithPassword({
                  email: authUser?.email as string,
                  password: password,
                });

                if (error) {
                  Alert.alert('Error', 'Invalid password');
                  resolve(false);
                } else {
                  resolve(true);
                }
              } catch (error) {
                Alert.alert('Error', 'Authentication failed');
                resolve(false);
              }
            },
          },
        ],
        'secure-text'
      );
    });
  };

  const handleExportContacts = async () => {
    const isAuthenticated = await authenticate();
    if (!isAuthenticated) return;

    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant permission to save files');
        return;
      }

      const { data: contacts, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', authUser?.id);

      if (error) throw error;

      Alert.alert(
        'Export Contacts',
        `Found ${contacts.length} contacts. Choose export format:`,
        [
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'CSV',
            onPress: async () => {
              try {
                // For CSV, use commas as separators and handle special characters
                const csvContent = contacts.map(contact => {
                  const escapeCsvField = (field: any): string => {
                    const stringValue = field?.toString() || '';
                    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                      return `"${stringValue.replace(/"/g, '""')}"`;
                    }
                    return stringValue;
                  };

                  return [
                    escapeCsvField(contact.full_name),
                    escapeCsvField(contact.phone_number),
                    escapeCsvField(contact.address),
                    escapeCsvField(contact.occupation_1),
                    escapeCsvField(contact.occupation_2),
                    escapeCsvField(contact.occupation_3),
                    escapeCsvField(contact.occupation_4),
                    escapeCsvField(contact.expected_wage),
                    escapeCsvField(contact.work_experience),
                    escapeCsvField(contact.daily_wage)
                  ].join(',');
                }).join('\n');
                
                const csvHeader = 'Name,Phone,Address,Occupation1,Occupation2,Occupation3,Occupation4,Expected Wage,Work Experience,Daily Wage';
                const csvFileContent = csvHeader + '\n' + csvContent;
                
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const fileName = `contacts_export_${timestamp}.csv`;
                const filePath = `${FileSystem.documentDirectory}${fileName}`;

                await FileSystem.writeAsStringAsync(filePath, csvFileContent, {
                  encoding: FileSystem.EncodingType.UTF8
                });

                const asset = await MediaLibrary.createAssetAsync(filePath);
                const album = await MediaLibrary.getAlbumAsync('Download');
                
                if (album === null) {
                  await MediaLibrary.createAlbumAsync('Download', asset, false);
                } else {
                  await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
                }

                Alert.alert(
                  'Success',
                  `File saved as: ${fileName}\nLocation: Downloads folder`,
                  [{ text: 'OK' }]
                );

                await FileSystem.deleteAsync(filePath);
              } catch (error: any) {
                console.error('CSV export error:', error);
                Alert.alert('Error', 'Failed to save CSV file. Error: ' + (error.message || 'Unknown error'));
              }
            }
          },
          {
            text: 'Excel Compatible',
            onPress: async () => {
              try {
                // For Excel, create a tab-separated values (TSV) file which Excel can open directly
                const excelContent = contacts.map(contact => {
                  const escapeExcelField = (field: any): string => {
                    const stringValue = field?.toString() || '';
                    if (stringValue.includes('\t') || stringValue.includes('\n')) {
                      return `"${stringValue.replace(/"/g, '""')}"`;
                    }
                    return stringValue;
                  };

                  return [
                    escapeExcelField(contact.full_name),
                    escapeExcelField(contact.phone_number),
                    escapeExcelField(contact.address),
                    escapeExcelField(contact.occupation_1),
                    escapeExcelField(contact.occupation_2),
                    escapeExcelField(contact.occupation_3),
                    escapeExcelField(contact.occupation_4),
                    escapeExcelField(contact.expected_wage),
                    escapeExcelField(contact.work_experience),
                    escapeExcelField(contact.daily_wage)
                  ].join('\t');
                }).join('\n');
                
                const excelHeader = 'Name\tPhone\tAddress\tOccupation1\tOccupation2\tOccupation3\tOccupation4\tExpected Wage\tWork Experience\tDaily Wage';
                const excelFileContent = excelHeader + '\n' + excelContent;
                
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const fileName = `contacts_export_${timestamp}.xls`;  // Changed to .xls
                const filePath = `${FileSystem.documentDirectory}${fileName}`;

                await FileSystem.writeAsStringAsync(filePath, excelFileContent, {
                  encoding: FileSystem.EncodingType.UTF8
                });

                const asset = await MediaLibrary.createAssetAsync(filePath);
                const album = await MediaLibrary.getAlbumAsync('Download');
                
                if (album === null) {
                  await MediaLibrary.createAlbumAsync('Download', asset, false);
                } else {
                  await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
                }

                Alert.alert(
                  'Success',
                  `File saved as: ${fileName}\nLocation: Downloads folder`,
                  [{ text: 'OK' }]
                );

                await FileSystem.deleteAsync(filePath);
              } catch (error: any) {
                console.error('Excel export error:', error);
                Alert.alert('Error', 'Failed to save Excel file. Error: ' + (error.message || 'Unknown error'));
              }
            }
          }
        ]
      );
    } catch (error: any) {
      console.error('Export error:', error);
      Alert.alert('Error', 'Failed to export contacts. Error: ' + (error.message || 'Unknown error'));
    }
  };

  const pickAndImportFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'text/csv',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/plain',
          'application/octet-stream'
        ],
        copyToCacheDirectory: true
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const fileUri = result.assets[0].uri;
        const fileContent = await FileSystem.readAsStringAsync(fileUri);
        
        // Split content into rows and remove any empty rows
        const rows = fileContent.split('\n').filter(row => row.trim());
        
        // Get headers from first row and clean them
        const headers = rows[0].toLowerCase().split(/[,;\t]/).map(header => 
          header.trim().replace(/['"]/g, '').replace(/\s+/g, '_')
        );

        console.log('Found headers:', headers); // Debug log

        // Define possible header variations
        const headerMappings = {
          full_name: ['full_name', 'fullname', 'name', 'contact_name', 'contactname'],
          phone_number: ['phone_number', 'phonenumber', 'phone', 'mobile', 'contact_number', 'contactnumber'],
          address: ['address', 'location', 'place'],
          occupation_1: ['occupation_1', 'occupation1', 'primary_occupation', 'primaryoccupation'],
          occupation_2: ['occupation_2', 'occupation2', 'secondary_occupation'],
          occupation_3: ['occupation_3', 'occupation3', 'tertiary_occupation'],
          occupation_4: ['occupation_4', 'occupation4', 'other_occupation'],
          expected_wage: ['expected_wage', 'expectedwage', 'wage_expected', 'salary_expected'],
          work_experience: ['work_experience', 'workexperience', 'experience', 'years_of_experience'],
          daily_wage: ['daily_wage', 'dailywage', 'per_day_wage', 'daily_salary']
        };

        // Create column mapping
        const columnMap: Record<string, number> = {};
        
        Object.entries(headerMappings).forEach(([key, variations]) => {
          const index = headers.findIndex(header => 
            variations.includes(header)
          );
          columnMap[key] = index;
        });

        console.log('Column mapping:', columnMap); // Debug log

        // Parse data rows
        const contacts = rows.slice(1)
          .map((row, rowIndex) => {
            // Split row and clean values
            const values = row.split(/[,;\t]/).map(value => 
              value.trim().replace(/^["']|["']$/g, '')
            );

            // Create contact object with mapped columns
            const contact = {
              full_name: values[columnMap.full_name] || '',
              phone_number: values[columnMap.phone_number] || '',
              address: values[columnMap.address] || '',
              occupation_1: values[columnMap.occupation_1] || '',
              occupation_2: values[columnMap.occupation_2] || '',
              occupation_3: values[columnMap.occupation_3] || '',
              occupation_4: values[columnMap.occupation_4] || '',
              expected_wage: values[columnMap.expected_wage] || '',
              work_experience: values[columnMap.work_experience] || '',
              daily_wage: values[columnMap.daily_wage] || '',
              user_id: authUser?.id
            };

            // Debug log for first few rows
            if (rowIndex < 2) {
              console.log(`Row ${rowIndex + 1} values:`, values);
              console.log(`Row ${rowIndex + 1} mapped contact:`, contact);
            }

            return contact;
          })
          .filter(contact => {
            const isValid = contact.full_name && contact.phone_number;
            if (!isValid) {
              console.warn('Invalid contact details:', {
                headers,
                columnMap,
                contact
              });
            }
            return isValid;
          });

        if (contacts.length > 0) {
          Alert.alert(
            'Import Preview',
            `Found ${contacts.length} valid contacts to import.\n\nFirst contact:\n` +
            `Name: ${contacts[0].full_name}\n` +
            `Phone: ${contacts[0].phone_number}\n` +
            `Address: ${contacts[0].address}`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Import',
                onPress: async () => {
                  try {
                    const { error } = await supabase
                      .from('contacts')
                      .insert(contacts);

                    if (error) throw error;

                    // Refresh contacts
                    await refreshContacts();

                    Alert.alert(
                      'Success',
                      `Imported ${contacts.length} contacts successfully!`,
                      [{ 
                        text: 'OK',
                        onPress: () => {
                          // Navigate back to home screen
                          router.replace('/(tabs)/home');
                        }
                      }]
                    );
                  } catch (error) {
                    console.error('Database insert error:', error);
                    Alert.alert('Error', 'Failed to import contacts to database');
                  }
                }
              }
            ]
          );
        } else {
          Alert.alert(
            'Error', 
            'No valid contacts found in the file. Please ensure the file has the correct format with required fields (name and phone number).\n\n' +
            'Expected headers (or similar):\n' +
            '- Name\n' +
            '- Phone Number\n' +
            '- Address\n' +
            '- Occupation 1\n' +
            '- Occupation 2\n' +
            '- Occupation 3\n' +
            '- Occupation 4\n' +
            '- Expected Wage\n' +
            '- Work Experience\n' +
            '- Daily Wage'
          );
        }
      }
    } catch (error: any) {
      console.error('Import error:', error);
      Alert.alert(
        'Error',
        'Failed to import contacts. Please check the file format and try again.'
      );
    }
  };

  const handleImportContacts = async () => {
    const isAuthenticated = await authenticate();
    if (!isAuthenticated) return;

    Alert.alert(
      'Import Contacts',
      'Choose a CSV or Excel file to import contacts',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Select File',
          onPress: pickAndImportFile
        }
      ]
    );
  };

  const handleDeleteAccount = async () => {
    if (isDeletingAccount) return;

    Alert.alert(
      'Delete Account',
      'This action cannot be undone. All your contacts will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeletingAccount(true);
            try {
              const isAuthenticated = await authenticate();
              if (!isAuthenticated) {
                Alert.alert('Error', 'Authentication required to delete account');
                return;
              }

              // First delete the auth user through Edge Function
              const { error: deleteError } = await supabase.functions.invoke('delete-user', {
                body: { userId: authUser?.id }
              });

              if (deleteError) throw deleteError;

              // Then delete profile data (will cascade)
              const { error: profileError } = await supabase
                .from('profiles')
                .delete()
                .eq('id', authUser?.id);

              if (profileError) throw profileError;

              // Finally delete contacts (if not handled by cascade)
              const { error: contactsError } = await supabase
                .from('contacts')
                .delete()
                .eq('user_id', authUser?.id);

              if (contactsError) throw contactsError;

              // Sign out the user
              await signOut();
              
              Alert.alert(
                'Account Deleted',
                'Your account has been successfully deleted.',
                [{ text: 'OK', onPress: () => router.replace('/(auth)' as any) }]
              );
            } catch (error) {
              console.error('Delete account error:', error);
              Alert.alert(
                'Error',
                'Failed to delete account. Please try again or contact support.'
              );
            } finally {
              setIsDeletingAccount(false);
            }
          }
        }
      ]
    );
  };

  const handleReportBug = () => {
    const subject = encodeURIComponent('Bug Report - Contact Manager App');
    const body = encodeURIComponent(
      `Device Details:
OS: ${Platform.OS}
Version: ${Platform.Version}
App Version: ${APP_VERSION}

Bug Description:
[Please describe the issue you encountered]

Steps to Reproduce:
1.
2.
3.

Expected Behavior:
[What did you expect to happen?]

Actual Behavior:
[What actually happened?]`
    );
    
    Linking.openURL(`mailto:yerraakash128@gmail.com?subject=${subject}&body=${body}`);
  };

  const handleHelpFAQs = () => {
    Alert.alert(
      '📚 Help & FAQs',
      `Welcome to Contact Manager Help Center!

🔷 BASIC OPERATIONS

Q: How do I add a new contact?
━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Tap the "+" floating button
• Fill in the contact details
• Add multiple occupations if needed
• Enter wage information
• Tap "Save" to create contact

Q: How do I use voice commands?
━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Enable voice commands in Settings
• Tap the microphone icon
• Try commands like:
  - "Add new contact"
  - "Search [name]"
  - "Edit contact [name]"
  - "Delete contact [name]"

🔷 DATA MANAGEMENT

Q: How do I backup my contacts?
━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Go to Settings > Backup & Export
• Choose "Export Contacts"
• Select CSV or Excel format
• File will be saved to Downloads

Q: How do I import contacts?
━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Go to Settings > Backup & Export
• Select "Import Contacts"
• Choose your file
• Review and confirm import

🔷 SECURITY

Q: How do I secure my account?
━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Enable Biometric Authentication
• Set up App Lock
• Use a strong password
• Regular backups recommended

Need more help? Contact our support team at:
yerraakash128@gmail.com`,
      [{ text: 'Got it!', style: 'default' }]
    );
  };

  const handleAboutApp = () => {
    Alert.alert(
      '📱 About Contact Manager',
      `Version ${APP_VERSION}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
💫 Developed with ❤️ by FRIEND
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Contact Manager is your intelligent companion for managing worker contacts efficiently. Built with modern technology and designed for simplicity.

🌟 KEY FEATURES
• Voice-controlled operations
• Multi-occupation tracking
• Wage management system
• Smart search capabilities
• Secure data storage
• Cloud synchronization
• Import/Export functionality
• Dark/Light theme support

🛠️ TECHNICAL STACK
• React Native + Expo
• Supabase Backend
• Voice Recognition
• Local Authentication
• Cloud Storage

🔒 PRIVACY & SECURITY
• End-to-end encryption
• Biometric protection
• Secure cloud backup
• Regular security updates

📧 CONTACT & SUPPORT
Email: yerraakash128@gmail.com
Website: contactmanager.com

━━━━━━━━━━━━━━━━━━━━━━━━━━━
© 2024 Contact Manager
All rights reserved.

Made in India 🇮🇳`,
      [{ text: 'Close', style: 'default' }]
    );
  };

  const handleVoiceSettings = () => {
    Alert.alert(
      'Voice Settings',
      'Choose voice type:',
      [
        { text: 'Female', onPress: () => setVoiceType('female') },
        { text: 'Male', onPress: () => setVoiceType('male') },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const handleSignOut = async () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: signOut
        }
      ]
    );
  };

  const handleAppLockToggle = async () => {
    const isAuthenticated = await authenticate();
    if (!isAuthenticated) return;

    setIsAppLockEnabled(prev => !prev);
    Alert.alert(
      'App Lock',
      isAppLockEnabled ? 
        'App lock has been disabled' : 
        'App lock has been enabled. You will need to authenticate when opening the app.'
    );
  };

  const handleEditProfile = async () => {
    const isAuthenticated = await authenticate();
    if (!isAuthenticated) return;

    setIsEditModalVisible(true);
  };

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser?.id)
        .single();

      if (error) throw error;
      if (data) {
        setProfileData({
          full_name: data.full_name || '',
          avatar_url: data.avatar_url || '',
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const EditProfileModal = ({ visible, onClose, initialData }: EditProfileModalProps) => {
    const [data, setData] = useState(initialData);
    const [loading, setLoading] = useState(false);
    const [newImage, setNewImage] = useState<string | null>(null);

    const handleImagePick = async () => {
      try {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.5,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
          const selectedImage = result.assets[0];
          setNewImage(selectedImage.uri);
          setData((prev: typeof initialData) => ({ ...prev, avatar_url: selectedImage.uri }));
        }
      } catch (error: any) {
        console.error('Image picker error:', error);
        Alert.alert('Error', 'Failed to pick image: ' + (error.message || 'Unknown error'));
      }
    };

    const handleSave = async () => {
      try {
        setLoading(true);
        let avatar_url = data.avatar_url;

        if (newImage) {
          try {
            // Get file info and extension
            const fileExt = newImage.split('.').pop()?.toLowerCase() || 'jpg';
            const fileName = `${authUser?.id}/${Date.now()}.${fileExt}`;

            // Convert image to base64
            const base64 = await FileSystem.readAsStringAsync(newImage, {
              encoding: FileSystem.EncodingType.Base64,
            });

            // Delete old avatar if exists
            const { data: oldFiles } = await supabase.storage
              .from('avatars')
              .list(authUser?.id || '');

            if (oldFiles && oldFiles.length > 0) {
              await supabase.storage
                .from('avatars')
                .remove(oldFiles.map(file => `${authUser?.id}/${file.name}`));
            }

            // Upload new avatar
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('avatars')
              .upload(fileName, decode(base64), {
                contentType: `image/${fileExt}`,
                upsert: false // Changed to false since we're deleting old files
              });

            if (uploadError) {
              console.error('Upload error details:', uploadError);
              throw uploadError;
            }

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
              .from('avatars')
              .getPublicUrl(fileName);

            avatar_url = publicUrl;

          } catch (uploadError: any) {
            console.error('Image upload error details:', uploadError);
            Alert.alert('Error', 'Failed to upload image. Please try again.');
            return;
          }
        }

        // Update profile in database
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            full_name: data.full_name,
            avatar_url: avatar_url,
            updated_at: new Date().toISOString(),
          })
          .eq('id', authUser?.id);

        if (profileError) throw profileError;

        // Update local state
        setProfileData({
          full_name: data.full_name,
          avatar_url: avatar_url,
        });

        // Close modal and show success message
        setIsEditModalVisible(false);
        Alert.alert('Success', 'Profile updated successfully');
        
      } catch (error) {
        console.error('Profile update error:', error);
        Alert.alert('Error', 'Failed to update profile');
      } finally {
        setLoading(false);
      }
    };

    return (
      <Modal
        visible={visible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setIsEditModalVisible(false);
        }}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, isDarkMode && styles.modalContentDark]}>
            <Text style={[styles.modalTitle, isDarkMode && styles.modalTitleDark]}>
              Edit Profile
            </Text>
            
            <TouchableOpacity style={styles.avatarPicker} onPress={handleImagePick}>
              {data.avatar_url ? (
                <Image source={{ uri: data.avatar_url }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="camera" size={40} color="#666" />
                </View>
              )}
            </TouchableOpacity>

            <TextInput
              style={[styles.input, isDarkMode && styles.inputDark]}
              value={data.full_name}
              onChangeText={(text) => setData((prev: typeof initialData) => ({ ...prev, full_name: text }))}
              placeholder="Full Name"
              placeholderTextColor={isDarkMode ? "#666" : "#999"}
            />

            <Text style={[styles.label, isDarkMode && styles.labelDark]}>
              Email: {authUser?.email}
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setIsEditModalVisible(false)}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSave}
                disabled={loading}
              >
                <Text style={styles.buttonText}>
                  {loading ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <>
      <ScrollView style={[styles.container, isDarkMode && styles.containerDark]}>
        {/* Profile Header */}
        <LinearGradient
          colors={isDarkMode ? ['#1a237e', '#3949ab'] : ['#3949ab', '#5c6bc0']}
          style={styles.profileHeader}
        >
          <View style={styles.avatarContainer}>
            {profileData.avatar_url ? (
              <Image
                source={{ uri: profileData.avatar_url }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={40} color="#fff" />
              </View>
            )}
          </View>
          <Text style={styles.userName}>
            {profileData.full_name || authUser?.email}
          </Text>
          <Text style={styles.userEmail}>{authUser?.email}</Text>
        </LinearGradient>

        {/* Theme & UI Customization */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
            Theme & UI
          </Text>
          
          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="moon-outline" size={24} color={isDarkMode ? "#fff" : "#333"} />
              <Text style={[styles.settingText, isDarkMode && styles.settingTextDark]}>
                Dark Mode
              </Text>
            </View>
            <Switch
              value={isDarkMode}
              onValueChange={toggleTheme}
              trackColor={{ false: '#767577', true: '#1a237e' }}
              thumbColor={isDarkMode ? '#3949ab' : '#f4f3f4'}
            />
          </TouchableOpacity>
        </View>

        {/* Voice Assistant */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
            Voice Assistant
          </Text>
          
          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="mic-outline" size={24} color={isDarkMode ? "#fff" : "#333"} />
              <Text style={[styles.settingText, isDarkMode && styles.settingTextDark]}>
                Voice Commands
              </Text>
            </View>
            <Switch
              value={voiceCommandsEnabled}
              onValueChange={setVoiceCommandsEnabled}
              trackColor={{ false: '#767577', true: '#1a237e' }}
              thumbColor={isDarkMode ? '#3949ab' : '#f4f3f4'}
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="speedometer-outline" size={24} color={isDarkMode ? "#fff" : "#333"} />
              <Text style={[styles.settingText, isDarkMode && styles.settingTextDark]}>
                Voice Response Speed
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={isDarkMode ? "#fff" : "#333"} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="mic-outline" size={24} color={isDarkMode ? "#fff" : "#333"} />
              <Text style={[styles.settingText, isDarkMode && styles.settingTextDark]}>
                Voice Type
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={isDarkMode ? "#fff" : "#333"} />
          </TouchableOpacity>
        </View>

        {/* Security & Privacy */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
            Security & Privacy
          </Text>

          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="lock-closed-outline" size={24} color={isDarkMode ? "#fff" : "#333"} />
              <Text style={[styles.settingText, isDarkMode && styles.settingTextDark]}>
                App Lock
              </Text>
            </View>
            <Switch
              value={isAppLockEnabled}
              onValueChange={handleAppLockToggle}
              trackColor={{ false: '#767577', true: '#1a237e' }}
              thumbColor={isDarkMode ? '#3949ab' : '#f4f3f4'}
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="finger-print-outline" size={24} color={isDarkMode ? "#fff" : "#333"} />
              <Text style={[styles.settingText, isDarkMode && styles.settingTextDark]}>
                Biometric Authentication
              </Text>
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={handleBiometricToggle}
              disabled={!isBiometricSupported}
              trackColor={{ false: '#767577', true: '#1a237e' }}
              thumbColor={isDarkMode ? '#3949ab' : '#f4f3f4'}
            />
          </TouchableOpacity>
        </View>

        {/* Backup & Sync */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
            Backup & Export
          </Text>

          <TouchableOpacity style={styles.settingItem} onPress={handleExportContacts}>
            <View style={styles.settingLeft}>
              <Ionicons name="download-outline" size={24} color={isDarkMode ? "#fff" : "#333"} />
              <Text style={[styles.settingText, isDarkMode && styles.settingTextDark]}>
                Export Contacts
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={isDarkMode ? "#fff" : "#333"} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem} onPress={handleImportContacts}>
            <View style={styles.settingLeft}>
              <Ionicons name="cloud-upload-outline" size={24} color={isDarkMode ? "#fff" : "#333"} />
              <Text style={[styles.settingText, isDarkMode && styles.settingTextDark]}>
                Import Contacts
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={isDarkMode ? "#fff" : "#333"} />
          </TouchableOpacity>
        </View>

        {/* Support & Info */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
            Support & Info
          </Text>

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={handleHelpFAQs}
          >
            <View style={styles.settingLeft}>
              <Ionicons name="help-circle-outline" size={24} color={isDarkMode ? "#fff" : "#333"} />
              <Text style={[styles.settingText, isDarkMode && styles.settingTextDark]}>
                Help & FAQs
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={isDarkMode ? "#fff" : "#333"} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={handleReportBug}
          >
            <View style={styles.settingLeft}>
              <Ionicons name="bug-outline" size={24} color={isDarkMode ? "#fff" : "#333"} />
              <Text style={[styles.settingText, isDarkMode && styles.settingTextDark]}>
                Report a Bug
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={isDarkMode ? "#fff" : "#333"} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={handleAboutApp}
          >
            <View style={styles.settingLeft}>
              <Ionicons name="information-circle-outline" size={24} color={isDarkMode ? "#fff" : "#333"} />
              <Text style={[styles.settingText, isDarkMode && styles.settingTextDark]}>
                About the App
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={isDarkMode ? "#fff" : "#333"} />
          </TouchableOpacity>
        </View>

        {/* Account Management */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
            Account
          </Text>

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={handleEditProfile}
          >
            <View style={styles.settingLeft}>
              <Ionicons name="person-outline" size={24} color={isDarkMode ? "#fff" : "#333"} />
              <Text style={[styles.settingText, isDarkMode && styles.settingTextDark]}>
                Edit Profile
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={isDarkMode ? "#fff" : "#333"} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.settingItem, styles.deleteAccountButton]}
            onPress={handleDeleteAccount}
          >
            <View style={styles.settingLeft}>
              <Ionicons name="trash-outline" size={24} color="#ff4444" />
              <Text style={[styles.settingText, styles.deleteAccountText]}>
                Delete Account
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#ff4444" />
          </TouchableOpacity>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={24} color="#ff4444" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Floating Authentication Message */}
      {showAuthMessage && (
        <View style={styles.floatingMessage}>
          <View style={styles.messageContent}>
            <Ionicons name="finger-print" size={24} color="#fff" />
            <Text style={styles.messageText}>
              Authenticate to access all features
            </Text>
            <TouchableOpacity 
              style={styles.authenticateButton}
              onPress={handleBiometricToggle}
            >
              <Text style={styles.authenticateButtonText}>
                Authenticate
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <EditProfileModal
        visible={isEditModalVisible}
        onClose={() => setIsEditModalVisible(false)}
        initialData={profileData}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  containerDark: {
    backgroundColor: '#121212',
  },
  profileHeader: {
    padding: 20,
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 30,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#fff',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  sectionTitleDark: {
    color: '#fff',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingText: {
    fontSize: 16,
    marginLeft: 12,
    color: '#333',
  },
  settingTextDark: {
    color: '#fff',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginTop: 20,
    marginBottom: 40,
  },
  signOutText: {
    color: '#ff4444',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  deleteAccountButton: {
    marginTop: 8,
  },
  deleteAccountText: {
    color: '#ff4444',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    elevation: 5,
  },
  modalContentDark: {
    backgroundColor: '#1a1a1a',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  modalTitleDark: {
    color: '#fff',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    color: '#333',
  },
  inputDark: {
    borderColor: '#444',
    color: '#fff',
    backgroundColor: '#333',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    flex: 0.48,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#666',
  },
  saveButton: {
    backgroundColor: '#1a237e',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  floatingMessage: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#1a237e',
    borderRadius: 12,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  messageContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  messageText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 12,
    flex: 1,
  },
  authenticateButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginLeft: 12,
  },
  authenticateButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  avatarPicker: {
    alignSelf: 'center',
    marginBottom: 20,
  },
  avatarImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  labelDark: {
    color: '#aaa',
  },
}); 