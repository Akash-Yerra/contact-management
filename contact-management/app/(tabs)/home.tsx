import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  FlatList,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Image,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/supabase';
import { router } from 'expo-router';
import { Contact } from '@/types/database';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useContacts } from '@/contexts/ContactsContext';

type UserType = {
  user_metadata: {
    avatar_url?: string;
  };
} | null;

const CARD_GRADIENTS: [string, string][] = [
  ['#1a237e', '#3949ab'], // Primary card (dark blue)
  ['#00695c', '#00897b'], // Teal
  ['#4a148c', '#6a1b9a'], // Purple
  ['#1565c0', '#1976d2'], // Blue
  ['#2e7d32', '#43a047'], // Green
  ['#c62828', '#d32f2f'], // Red
  ['#e65100', '#f57c00'], // Orange
  ['#4527a0', '#5e35b1'], // Deep Purple
];

const windowHeight = Dimensions.get('window').height;

export default function HomeScreen() {
  const { user: authUser, signOut } = useAuth();
  const { contacts, refreshContacts, isLoading } = useContacts();
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewContactModalVisible, setIsNewContactModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [newContact, setNewContact] = useState({
    full_name: '',
    phone_number: '',
    address: '',
    occupation_1: '',
    occupation_2: '',
    occupation_3: '',
    occupation_4: '',
    expected_wage: '',
    work_experience: '',
    daily_wage: '',
  });
  const [viewingContact, setViewingContact] = useState<Contact | null>(null);
  const [isViewModalVisible, setIsViewModalVisible] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [profileData, setProfileData] = useState({
    full_name: '',
    avatar_url: '',
    email: authUser?.email || '',
  });

  const { isDarkMode } = useTheme();

  // Add validation state
  const [errors, setErrors] = useState({
    full_name: '',
    phone_number: '',
    expected_wage: '',
    daily_wage: '',
  });

  useFocusEffect(
    useCallback(() => {
      refreshContacts();
      fetchProfile();
    }, [refreshContacts])
  );

  const fetchProfile = async () => {
    if (!authUser?.id) return;

    try {
      // First try to get the existing profile
      let { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Profile doesn't exist, create one
          const { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .insert([
              {
                id: authUser.id,
                full_name: '',
                avatar_url: '',
                email: authUser.email,
                updated_at: new Date().toISOString()
              }
            ])
            .select()
            .single();

          if (insertError) throw insertError;
          data = newProfile;
        } else {
          throw error;
        }
      }

      if (data) {
        setProfileData({
          full_name: data.full_name || '',
          avatar_url: data.avatar_url || '',
          email: authUser.email || '',
        });
      }
    } catch (error) {
      console.error('Error fetching/creating profile:', error);
      // Set default profile data even if there's an error
      setProfileData({
        full_name: '',
        avatar_url: '',
        email: authUser?.email || '',
      });
    }
  };

  const navigateToProfile = () => {
    router.push("/(tabs)/settings");
  };

  const toggleNewContactModal = () => {
    setIsNewContactModalVisible(!isNewContactModalVisible);
  };

  const handleViewContact = (contact: Contact) => {
    setViewingContact(contact);
    setIsViewModalVisible(true);
  };

  const handleEditContact = (contact: Contact) => {
    setIsEditing(true);
    setEditingContactId(contact.id);
    setNewContact({
      full_name: contact.full_name,
      phone_number: contact.phone_number,
      address: contact.address,
      occupation_1: contact.occupation_1,
      occupation_2: contact.occupation_2,
      occupation_3: contact.occupation_3,
      occupation_4: contact.occupation_4,
      expected_wage: contact.expected_wage,
      work_experience: contact.work_experience,
      daily_wage: contact.daily_wage,
    });
    setIsNewContactModalVisible(true);
  };

  const handleDeleteContact = async (id: string) => {
    // Show confirmation dialog with custom UI
    Alert.alert(
      "Delete Contact",
      "Are you sure you want to delete this contact?",
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => {},
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('contacts')
                .delete()
                .eq('id', id);

              if (error) throw error;

              // Refresh contacts list
              refreshContacts();
              Alert.alert("Success", "Contact deleted successfully");
            } catch (error) {
              console.error('Error deleting contact:', error);
              Alert.alert('Error', 'Failed to delete contact. Please try again.');
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  // Add validation functions
  const validatePhoneNumber = (number: string) => {
    const phoneRegex = /^[6-9]\d{9}$/;  // Indian phone number format
    if (!number) return '';
    if (!phoneRegex.test(number)) {
      return 'Please enter a valid 10-digit phone number';
    }
    return '';
  };

  const validateName = (name: string) => {
    if (!name) return '';
    if (name.length < 3) {
      return 'Name should be at least 3 characters long';
    }
    return '';
  };

  const validateWage = (wage: string) => {
    if (!wage) return '';
    const wageNumber = Number(wage);
    if (isNaN(wageNumber) || wageNumber <= 0) {
      return 'Please enter a valid amount';
    }
    return '';
  };

  const handleAddContact = async () => {
    // Validate all fields
    const nameError = validateName(newContact.full_name);
    const phoneError = validatePhoneNumber(newContact.phone_number);
    const dailyWageError = validateWage(newContact.daily_wage);
    const expectedWageError = validateWage(newContact.expected_wage);

    setErrors({
      full_name: nameError,
      phone_number: phoneError,
      daily_wage: dailyWageError,
      expected_wage: expectedWageError,
    });

    if (nameError || phoneError || dailyWageError || expectedWageError) {
      Alert.alert('Validation Error', 'Please fix the errors in the form');
      return;
    }

    if (!newContact.full_name || !newContact.phone_number) {
      Alert.alert('Error', 'Name and phone number are required');
      return;
    }

    try {
      if (isEditing && editingContactId) {
        // Update existing contact
        const { error } = await supabase
          .from('contacts')
          .update({
            ...newContact,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingContactId);

        if (error) throw error;
      } else {
        // Add new contact
        const { error } = await supabase
          .from('contacts')
          .insert([
            {
              user_id: authUser?.id,
              ...newContact,
            },
          ]);

        if (error) throw error;
      }

      // Refresh contacts list
      refreshContacts();
      // Reset form
      setNewContact({
        full_name: '',
        phone_number: '',
        address: '',
        occupation_1: '',
        occupation_2: '',
        occupation_3: '',
        occupation_4: '',
        expected_wage: '',
        work_experience: '',
        daily_wage: '',
      });
      setIsEditing(false);
      setEditingContactId(null);
      setIsNewContactModalVisible(false);
    } catch (error) {
      console.error('Error saving contact:', error);
      Alert.alert('Error', 'Failed to save contact. Please try again.');
    }
  };

  const renderContactCard = ({ item, index }: { item: Contact; index: number }) => {
    // Get gradient colors based on index
    const gradientColors = CARD_GRADIENTS[index % CARD_GRADIENTS.length] as [string, string];
    
    // Create lighter versions for light mode
    const lightModeColors: [string, string] = isDarkMode ? 
      gradientColors : 
      [lightenColor(gradientColors[0], 0.2), lightenColor(gradientColors[1], 0.2)];
    
    return (
      <LinearGradient
        colors={lightModeColors}
        style={[styles.contactCard, { elevation: 4 }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.8 }}
      >
        <View style={styles.contactHeader}>
          <View style={styles.nameContainer}>
            <Text 
              style={styles.contactName}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {item.full_name}
            </Text>
          </View>
          <View style={themedStyles.cardActionButtons}>
            <TouchableOpacity 
              style={themedStyles.cardActionButton}
              onPress={() => handleViewContact(item)}
            >
              <Ionicons name="eye-outline" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={themedStyles.cardActionButton}
              onPress={() => handleEditContact(item)}
            >
              <Ionicons name="pencil-outline" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={themedStyles.cardActionButton}
              onPress={() => handleDeleteContact(item.id)}
            >
              <Ionicons name="trash-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.contactDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="call-outline" size={18} color="#fff" />
            <Text style={styles.detailText}>{item.phone_number}</Text>
          </View>
          {item.address && (
            <View style={styles.detailRow}>
              <Ionicons name="location-outline" size={18} color="#fff" />
              <Text style={styles.detailText}>{item.address}</Text>
            </View>
          )}
        </View>

        <View style={styles.tagsContainer}>
          {item.occupation_1 && (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{item.occupation_1}</Text>
            </View>
          )}
          {item.occupation_2 && (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{item.occupation_2}</Text>
            </View>
          )}
          {item.occupation_3 && (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{item.occupation_3}</Text>
            </View>
          )}
          {item.occupation_4 && (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{item.occupation_4}</Text>
            </View>
          )}
        </View>

        {item.daily_wage && (
          <View style={styles.wageContainer}>
            <Ionicons name="cash-outline" size={18} color="#fff" />
            <Text style={styles.wageText}>
              Daily Wage: ₹{item.daily_wage}
            </Text>
          </View>
        )}

        {item.work_experience && (
          <View style={styles.experienceContainer}>
            <Ionicons name="briefcase-outline" size={18} color="#fff" />
            <Text style={styles.experienceText}>
              Experience: {item.work_experience}
            </Text>
          </View>
        )}
      </LinearGradient>
    );
  };

  // Update the lightenColor function to handle alpha
  const lightenColor = (color: string, factor: number): string => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    const lightenChannel = (channel: number) => 
      Math.min(255, Math.round(channel + (255 - channel) * factor));

    const toHex = (channel: number) => {
      const hex = channel.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(lightenChannel(r))}${toHex(lightenChannel(g))}${toHex(lightenChannel(b))}`;
  };

  const filteredContacts = contacts.filter(contact => 
    contact.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Create styles based on theme
  const getThemedStyles = () => StyleSheet.create({
    modalContent: {
      backgroundColor: isDarkMode ? '#1a237e' : '#fff',
      margin: 20,
      borderRadius: 15,
      maxHeight: '90%',
      position: 'relative',
      paddingBottom: 20,
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    },
    closeButton: {
      position: 'absolute',
      top: 16,
      right: 16,
      zIndex: 1,
      padding: 4,
    },
    modalHeader: {
      alignItems: 'center',
      padding: 20,
      paddingTop: 24,
      borderBottomWidth: 1,
      borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : '#eee',
      marginBottom: 10,
    },
    modalTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: isDarkMode ? '#fff' : '#333',
      letterSpacing: 0.5,
    },
    inputLabel: {
      fontSize: 16,
      marginBottom: 8,
      color: isDarkMode ? '#fff' : '#333',
      fontWeight: '600',
      letterSpacing: 0.3,
    },
    input: {
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.15)' : '#ddd',
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#f8f9fa',
      color: isDarkMode ? '#fff' : '#333',
      ...(!isDarkMode && {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
      }),
    },
    submitButton: {
      backgroundColor: isDarkMode ? '#4CAF50' : '#2196F3',
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
      marginTop: 20,
      marginBottom: 20,
      shadowColor: isDarkMode ? '#000' : '#2196F3',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    submitButtonText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: 'bold',
      letterSpacing: 0.5,
    },
    contactCard: {
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
    },
    contactHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
      gap: 12,
    },
    nameContainer: {
      flex: 1,
      marginRight: 8,
    },
    contactName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#fff',
    },
    cardActionButtons: {
      flexDirection: 'row',
      gap: 8,
      flexShrink: 0,
    },
    cardActionButton: {
      padding: 8,
      borderRadius: 20,
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 1,
      },
      shadowOpacity: 0.2,
      shadowRadius: 1.41,
      elevation: 2,
    },
    contactDetails: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: 16,
    },
    detailText: {
      fontSize: 16,
      color: '#fff',
    },
    tagsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 12,
    },
    tag: {
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
    },
    tagText: {
      color: '#fff',
      fontSize: 14,
    },
    wageContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 12,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      padding: 8,
      borderRadius: 8,
    },
    wageText: {
      color: '#fff',
      marginLeft: 8,
      fontSize: 16,
    },
    experienceContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      padding: 8,
      borderRadius: 8,
    },
    experienceText: {
      color: '#fff',
      marginLeft: 8,
      fontSize: 16,
    },
    fab: {
      position: 'absolute',
      right: 16,
      bottom: 80, // Increased to be above tab bar
      backgroundColor: '#1a237e',
      width: 50,
      height: 50,
      borderRadius: 25,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 4,
    },
    modalContainer: {
      flex: 1,
      justifyContent: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      padding: 20,
    },
    searchContainer: {
      padding: 16,
      paddingTop: 8,
      paddingBottom: 8,
    },
    searchInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 12,
      paddingHorizontal: 12,
      height: 45,
    },
    searchInputContainerLight: {
      backgroundColor: 'rgba(0, 0, 0, 0.05)',
      borderWidth: 1,
      borderColor: 'rgba(0, 0, 0, 0.1)',
    },
    searchInputContainerDark: {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    searchIcon: {
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      height: '100%',
    },
    searchInputDark: {
      color: '#fff',
    },
    searchInputLight: {
      color: '#000',
    },
    contactsList: {
      padding: 16,
      paddingBottom: 100,
    },
    fabGradient: {
      width: '100%',
      height: '100%',
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyStateContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
      paddingTop: 40,
    },
    emptyStateTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: 'rgba(255, 255, 255, 0.9)',
      marginTop: 16,
      marginBottom: 8,
      textAlign: 'center',
    },
    emptyStateText: {
      fontSize: 16,
      color: 'rgba(255, 255, 255, 0.7)',
      textAlign: 'center',
      lineHeight: 22,
    },
    emptyList: {
      flex: 1,
    },
    viewModalContent: {
      height: '80%',
      padding: 0,
      overflow: 'hidden',
    },
    viewModalHeader: {
      height: 120,
      overflow: 'hidden',
      borderTopLeftRadius: 15,
      borderTopRightRadius: 15,
    },
    viewModalHeaderGradient: {
      flex: 1,
      padding: 20,
      justifyContent: 'flex-end',
    },
    viewModalName: {
      fontSize: 28,
      fontWeight: 'bold',
      color: '#fff',
      marginBottom: 10,
    },
    closeViewButton: {
      position: 'absolute',
      top: 20,
      right: 20,
    },
    viewModalBody: {
      padding: 20,
    },
    viewSection: {
      marginBottom: 24,
    },
    viewRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    viewText: {
      fontSize: 18,
      marginLeft: 12,
      color: '#333',
    },
    viewTextDark: {
      color: '#fff',
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      marginBottom: 16,
      color: '#333',
    },
    sectionTitleDark: {
      color: '#fff',
    },
    occupationTag: {
      backgroundColor: '#1a237e',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      marginBottom: 8,
    },
    occupationText: {
      color: '#fff',
      fontSize: 16,
    },
    detailCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.05)',
      padding: 16,
      borderRadius: 12,
      marginBottom: 12,
    },
    detailInfo: {
      marginLeft: 12,
    },
    detailLabel: {
      fontSize: 14,
      color: '#666',
    },
    detailValue: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#333',
    },
    detailLabelDark: {
      color: '#aaa',
    },
    detailValueDark: {
      color: '#fff',
    },
    viewModalActionButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 24,
      paddingBottom: 24,
    },
    viewModalActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 25,
      flex: 0.48,
      justifyContent: 'center',
    },
    actionButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
      marginLeft: 8,
    },
    editButton: {
      backgroundColor: '#2196F3',
    },
    deleteButton: {
      backgroundColor: '#f44336',
    },
    inputError: {
      borderColor: '#ff4444',
      borderWidth: 1,
    },
    errorText: {
      color: '#ff4444',
      fontSize: 12,
      marginTop: 4,
      marginLeft: 4,
    },
    profileButton: {
      width: 40,  // Increased size
      height: 40, // Increased size
      borderRadius: 20,
      overflow: 'hidden',
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    headerProfileImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    headerProfilePlaceholder: {
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    profileMenuOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      zIndex: 100,
    },
    profileMenu: {
      position: 'absolute',
      top: 60,
      right: 16,
      backgroundColor: '#fff',
      borderRadius: 12,
      padding: 16,
      width: 280,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    profileHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: '#eee',
    },
    profileImage: {
      width: 48,
      height: 48,
      borderRadius: 24,
    },
    profileImagePlaceholder: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: '#1a237e',
      justifyContent: 'center',
      alignItems: 'center',
    },
    profileInfo: {
      marginLeft: 12,
      flex: 1,
    },
    profileName: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#333',
    },
    profileEmail: {
      fontSize: 14,
      color: '#666',
      marginTop: 2,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
    },
    menuItemText: {
      fontSize: 16,
      color: '#333',
      marginLeft: 12,
    },
    signOutItem: {
      marginTop: 8,
      borderTopWidth: 1,
      borderTopColor: '#eee',
      paddingTop: 16,
    },
    signOutText: {
      color: '#ff4444',
    },
    emptyStateWrapper: {
      flex: 1,
      height: windowHeight - 200, // Adjust this value based on your header and search height
      justifyContent: 'center',
      alignItems: 'center',
    },
  });

  // Get the themed styles
  const themedStyles = getThemedStyles();

  // Add the ProfileMenu component back
  const ProfileMenu = () => (
    <TouchableOpacity
      style={styles.profileMenuOverlay}
      activeOpacity={1}
      onPress={() => setShowProfileMenu(false)}
    >
      <View style={styles.profileMenu}>
        <View style={styles.profileHeader}>
          {profileData?.avatar_url ? (
            <Image
              source={{ uri: profileData.avatar_url }}
              style={styles.profileImage}
            />
          ) : (
            <View style={styles.profileImagePlaceholder}>
              <Ionicons name="person" size={24} color="#fff" />
            </View>
          )}
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>
              {profileData?.full_name || 'New User'}
            </Text>
            <Text style={styles.profileEmail}>
              {profileData?.email || authUser?.email || 'No email'}
            </Text>
          </View>
        </View>
        
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => {
            setShowProfileMenu(false);
            router.push('/(tabs)/settings');
          }}
        >
          <Ionicons name="settings-outline" size={20} color="#333" />
          <Text style={styles.menuItemText}>Settings</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, styles.signOutItem]}
          onPress={() => {
            setShowProfileMenu(false);
            Alert.alert(
              "Sign Out",
              "Are you sure you want to sign out?",
              [
                { text: "Cancel", style: "cancel" },
                { 
                  text: "Sign Out",
                  style: "destructive",
                  onPress: signOut
                }
              ]
            );
          }}
        >
          <Ionicons name="log-out-outline" size={20} color="#ff4444" />
          <Text style={[styles.menuItemText, styles.signOutText]}>
            Sign Out
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <LinearGradient
      colors={isDarkMode ? 
        ['#1a237e', '#121858'] : 
        ['#3f51b5', '#303f9f']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Contacts</Text>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => setShowProfileMenu(!showProfileMenu)}
          >
            {profileData?.avatar_url ? (
              <Image
                source={{ uri: profileData.avatar_url }}
                style={styles.headerProfileImage}
              />
            ) : (
              <View style={styles.headerProfilePlaceholder}>
                <Ionicons name="person-outline" size={24} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <View style={[
            styles.searchInputContainer,
            isDarkMode ? styles.searchInputContainerDark : styles.searchInputContainerLight
          ]}>
            <Ionicons 
              name="search" 
              size={20} 
              color={isDarkMode ? "rgba(255, 255, 255, 0.5)" : "rgba(0, 0, 0, 0.5)"} 
              style={styles.searchIcon}
            />
            <TextInput
              style={[
                styles.searchInput,
                isDarkMode ? styles.searchInputDark : styles.searchInputLight
              ]}
              placeholder="Search contacts..."
              placeholderTextColor={isDarkMode ? "rgba(255, 255, 255, 0.5)" : "rgba(0, 0, 0, 0.5)"}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        {contacts.length === 0 ? (
          <View style={styles.emptyStateWrapper}>
            <View style={styles.emptyStateContainer}>
              <Ionicons 
                name="people-outline" 
                size={80} 
                color="rgba(255, 255, 255, 0.5)"
              />
              <Text style={styles.emptyStateTitle}>
                No Contacts Yet
              </Text>
              <Text style={styles.emptyStateText}>
                Add your first contact by tapping the + button below
              </Text>
            </View>
          </View>
        ) : (
          <FlatList
            data={filteredContacts}
            renderItem={renderContactCard}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.contactsList}
            showsVerticalScrollIndicator={false}
          />
        )}

        <TouchableOpacity
          style={styles.fab}
          onPress={toggleNewContactModal}
        >
          <LinearGradient
            colors={['#1a237e', '#3949ab']}
            style={styles.fabGradient}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>

        {showProfileMenu && <ProfileMenu />}
      </SafeAreaView>

      <Modal
        visible={isNewContactModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={toggleNewContactModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={themedStyles.modalContent}>
            <View style={themedStyles.modalHeader}>
              <Text style={themedStyles.modalTitle}>
                {isEditing ? 'Edit Contact' : 'New Contact'}
              </Text>
              <TouchableOpacity 
                style={themedStyles.closeButton}
                onPress={toggleNewContactModal}
              >
                <Ionicons 
                  name="close" 
                  size={24} 
                  color={isDarkMode ? "rgba(255, 255, 255, 0.8)" : "#666"} 
                />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={[styles.formContainer, { paddingHorizontal: 20 }]}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.inputGroup}>
                <Text style={themedStyles.inputLabel}>Name *</Text>
                <TextInput
                  style={[
                    themedStyles.input,
                    errors.full_name ? styles.inputError : null
                  ]}
                  value={newContact.full_name}
                  onChangeText={(text) => {
                    setNewContact(prev => ({ ...prev, full_name: text }));
                    setErrors(prev => ({ ...prev, full_name: validateName(text) }));
                  }}
                  onBlur={() => {
                    setErrors(prev => ({ 
                      ...prev, 
                      full_name: validateName(newContact.full_name) 
                    }));
                  }}
                  placeholder="Enter name"
                  placeholderTextColor={isDarkMode ? "#666" : "#999"}
                />
                {errors.full_name ? (
                  <Text style={styles.errorText}>{errors.full_name}</Text>
                ) : null}
              </View>

              <View style={styles.inputGroup}>
                <Text style={themedStyles.inputLabel}>Phone Number *</Text>
                <TextInput
                  style={[
                    themedStyles.input,
                    errors.phone_number ? styles.inputError : null
                  ]}
                  value={newContact.phone_number}
                  onChangeText={(text) => {
                    const numbersOnly = text.replace(/[^0-9]/g, '');
                    setNewContact(prev => ({ ...prev, phone_number: numbersOnly }));
                    setErrors(prev => ({ ...prev, phone_number: validatePhoneNumber(numbersOnly) }));
                  }}
                  onBlur={() => {
                    setErrors(prev => ({ 
                      ...prev, 
                      phone_number: validatePhoneNumber(newContact.phone_number) 
                    }));
                  }}
                  placeholder="Enter phone number"
                  placeholderTextColor={isDarkMode ? "#666" : "#999"}
                  keyboardType="number-pad"
                  maxLength={10}
                />
                {errors.phone_number ? (
                  <Text style={styles.errorText}>{errors.phone_number}</Text>
                ) : null}
              </View>

              <View style={styles.inputGroup}>
                <Text style={themedStyles.inputLabel}>Address</Text>
                <TextInput
                  style={[themedStyles.input, styles.textArea]}
                  value={newContact.address}
                  onChangeText={(text) => setNewContact(prev => ({ ...prev, address: text }))}
                  placeholder="Enter address"
                  placeholderTextColor={isDarkMode ? "#666" : "#999"}
                  multiline
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={themedStyles.inputLabel}>Occupation 1</Text>
                <TextInput
                  style={themedStyles.input}
                  value={newContact.occupation_1}
                  onChangeText={(text) => setNewContact(prev => ({ ...prev, occupation_1: text }))}
                  placeholder="Enter occupation 1"
                  placeholderTextColor={isDarkMode ? "#666" : "#999"}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={themedStyles.inputLabel}>Occupation 2</Text>
                <TextInput
                  style={themedStyles.input}
                  value={newContact.occupation_2}
                  onChangeText={(text) => setNewContact(prev => ({ ...prev, occupation_2: text }))}
                  placeholder="Enter occupation 2"
                  placeholderTextColor={isDarkMode ? "#666" : "#999"}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={themedStyles.inputLabel}>Occupation 3</Text>
                <TextInput
                  style={themedStyles.input}
                  value={newContact.occupation_3}
                  onChangeText={(text) => setNewContact(prev => ({ ...prev, occupation_3: text }))}
                  placeholder="Enter occupation 3"
                  placeholderTextColor={isDarkMode ? "#666" : "#999"}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={themedStyles.inputLabel}>Occupation 4</Text>
                <TextInput
                  style={themedStyles.input}
                  value={newContact.occupation_4}
                  onChangeText={(text) => setNewContact(prev => ({ ...prev, occupation_4: text }))}
                  placeholder="Enter occupation 4"
                  placeholderTextColor={isDarkMode ? "#666" : "#999"}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={themedStyles.inputLabel}>Expected Wage</Text>
                <TextInput
                  style={themedStyles.input}
                  value={newContact.expected_wage}
                  onChangeText={(text) => setNewContact(prev => ({ ...prev, expected_wage: text }))}
                  placeholder="Enter expected wage"
                  placeholderTextColor={isDarkMode ? "#666" : "#999"}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={themedStyles.inputLabel}>Work Experience</Text>
                <TextInput
                  style={themedStyles.input}
                  value={newContact.work_experience}
                  onChangeText={(text) => setNewContact(prev => ({ ...prev, work_experience: text }))}
                  placeholder="Enter work experience"
                  placeholderTextColor={isDarkMode ? "#666" : "#999"}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={themedStyles.inputLabel}>Daily Wage</Text>
                <TextInput
                  style={[
                    themedStyles.input,
                    errors.daily_wage ? styles.inputError : null
                  ]}
                  value={newContact.daily_wage}
                  onChangeText={(text) => {
                    const numbersOnly = text.replace(/[^0-9]/g, '');
                    setNewContact(prev => ({ ...prev, daily_wage: numbersOnly }));
                    setErrors(prev => ({ ...prev, daily_wage: validateWage(numbersOnly) }));
                  }}
                  onBlur={() => {
                    setErrors(prev => ({ 
                      ...prev, 
                      daily_wage: validateWage(newContact.daily_wage) 
                    }));
                  }}
                  placeholder="Enter daily wage"
                  placeholderTextColor={isDarkMode ? "#666" : "#999"}
                  keyboardType="number-pad"
                />
                {errors.daily_wage ? (
                  <Text style={styles.errorText}>{errors.daily_wage}</Text>
                ) : null}
              </View>

              <TouchableOpacity 
                style={themedStyles.submitButton}
                onPress={handleAddContact}
              >
                <Text style={styles.submitButtonText}>
                  {isEditing ? 'Save Changes' : 'Add Contact'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={isViewModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsViewModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[themedStyles.modalContent, styles.viewModalContent]}>
            {viewingContact && (
              <>
                <View style={styles.viewModalHeader}>
                  <LinearGradient
                    colors={isDarkMode ? ['#283593', '#1a237e'] : ['#5c6bc0', '#3f51b5']}
                    style={styles.viewModalHeaderGradient}
                  >
                    <Text style={styles.viewModalName}>{viewingContact.full_name}</Text>
                    <TouchableOpacity 
                      style={styles.closeViewButton}
                      onPress={() => setIsViewModalVisible(false)}
                    >
                      <Ionicons name="close" size={24} color="#fff" />
                    </TouchableOpacity>
                  </LinearGradient>
                </View>

                <ScrollView style={styles.viewModalBody}>
                  <View style={styles.viewSection}>
                    <View style={styles.viewRow}>
                      <Ionicons name="call" size={24} color={isDarkMode ? '#fff' : '#333'} />
                      <Text style={[styles.viewText, isDarkMode && styles.viewTextDark]}>
                        {viewingContact.phone_number}
                      </Text>
                    </View>

                    {viewingContact.address && (
                      <View style={styles.viewRow}>
                        <Ionicons name="location" size={24} color={isDarkMode ? '#fff' : '#333'} />
                        <Text style={[styles.viewText, isDarkMode && styles.viewTextDark]}>
                          {viewingContact.address}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.viewSection}>
                    <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
                      Occupations
                    </Text>
                    {[
                      viewingContact.occupation_1,
                      viewingContact.occupation_2,
                      viewingContact.occupation_3,
                      viewingContact.occupation_4,
                    ].filter(Boolean).map((occupation, index) => (
                      <View key={index} style={styles.occupationTag}>
                        <Text style={styles.occupationText}>{occupation}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.viewSection}>
                    <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
                      Work Details
                    </Text>
                    {viewingContact.daily_wage && (
                      <View style={styles.detailCard}>
                        <Ionicons name="cash" size={24} color={isDarkMode ? '#fff' : '#333'} />
                        <View style={styles.detailInfo}>
                          <Text style={[styles.detailLabel, isDarkMode && styles.detailLabelDark]}>
                            Daily Wage
                          </Text>
                          <Text style={[styles.detailValue, isDarkMode && styles.detailValueDark]}>
                            ₹{viewingContact.daily_wage}
                          </Text>
                        </View>
                      </View>
                    )}

                    {viewingContact.expected_wage && (
                      <View style={styles.detailCard}>
                        <Ionicons name="trending-up" size={24} color={isDarkMode ? '#fff' : '#333'} />
                        <View style={styles.detailInfo}>
                          <Text style={[styles.detailLabel, isDarkMode && styles.detailLabelDark]}>
                            Expected Wage
                          </Text>
                          <Text style={[styles.detailValue, isDarkMode && styles.detailValueDark]}>
                            ₹{viewingContact.expected_wage}
                          </Text>
                        </View>
                      </View>
                    )}

                    {viewingContact.work_experience && (
                      <View style={styles.detailCard}>
                        <Ionicons name="briefcase" size={24} color={isDarkMode ? '#fff' : '#333'} />
                        <View style={styles.detailInfo}>
                          <Text style={[styles.detailLabel, isDarkMode && styles.detailLabelDark]}>
                            Work Experience
                          </Text>
                          <Text style={[styles.detailValue, isDarkMode && styles.detailValueDark]}>
                            {viewingContact.work_experience}
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>

                  <View style={styles.viewModalActionButtons}>
                    <TouchableOpacity 
                      style={[styles.viewModalActionButton, styles.editButton]}
                      onPress={() => {
                        setIsViewModalVisible(false);
                        handleEditContact(viewingContact);
                      }}
                    >
                      <Ionicons name="pencil" size={20} color="#fff" />
                      <Text style={styles.actionButtonText}>Edit</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={[styles.viewModalActionButton, styles.deleteButton]}
                      onPress={() => {
                        setIsViewModalVisible(false);
                        handleDeleteContact(viewingContact.id);
                      }}
                    >
                      <Ionicons name="trash" size={20} color="#fff" />
                      <Text style={styles.actionButtonText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  profileButton: {
    width: 40,  // Increased size
    height: 40, // Increased size
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  headerProfileImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  headerProfilePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  searchContainer: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 45,
  },
  searchInputContainerLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  searchInputContainerDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
  searchInputDark: {
    color: '#fff',
  },
  searchInputLight: {
    color: '#000',
  },
  contactsList: {
    padding: 16,
    paddingBottom: 100,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 80, // Increased to be above tab bar
    backgroundColor: '#1a237e',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 20,
  },
  formContainer: {
    paddingVertical: 10,
  },
  inputGroup: {
    marginBottom: 20,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  contactCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  contactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  nameContainer: {
    flex: 1,
    marginRight: 8,
  },
  contactName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  contactDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  detailText: {
    fontSize: 16,
    color: '#fff',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  tag: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagText: {
    color: '#fff',
    fontSize: 14,
  },
  wageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 8,
    borderRadius: 8,
  },
  wageText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 16,
  },
  experienceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 8,
    borderRadius: 8,
  },
  experienceText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 16,
  },
  fabGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewModalContent: {
    height: '80%',
    padding: 0,
    overflow: 'hidden',
  },
  viewModalHeader: {
    height: 120,
    overflow: 'hidden',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
  },
  viewModalHeaderGradient: {
    flex: 1,
    padding: 20,
    justifyContent: 'flex-end',
  },
  viewModalName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  closeViewButton: {
    position: 'absolute',
    top: 20,
    right: 20,
  },
  viewModalBody: {
    padding: 20,
  },
  viewSection: {
    marginBottom: 24,
  },
  viewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  viewText: {
    fontSize: 18,
    marginLeft: 12,
    color: '#333',
  },
  viewTextDark: {
    color: '#fff',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  sectionTitleDark: {
    color: '#fff',
  },
  occupationTag: {
    backgroundColor: '#1a237e',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 8,
  },
  occupationText: {
    color: '#fff',
    fontSize: 16,
  },
  detailCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  detailInfo: {
    marginLeft: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  detailLabelDark: {
    color: '#aaa',
  },
  detailValueDark: {
    color: '#fff',
  },
  viewModalActionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    paddingBottom: 24,
  },
  viewModalActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    flex: 0.48,
    justifyContent: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  editButton: {
    backgroundColor: '#2196F3',
  },
  deleteButton: {
    backgroundColor: '#f44336',
  },
  emptyStateWrapper: {
    flex: 1,
    height: windowHeight - 200, // Adjust this value based on your header and search height
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateContainer: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 22,
  },
  inputError: {
    borderColor: '#ff4444',
    borderWidth: 1,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  profileMenuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 100,
  },
  profileMenu: {
    position: 'absolute',
    top: 60,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    width: 280,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  profileImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  profileImagePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1a237e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    marginLeft: 12,
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  profileEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  menuItemText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  signOutItem: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 16,
  },
  signOutText: {
    color: '#ff4444',
  },
}); 