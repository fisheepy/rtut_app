import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const MenuItem = ({ item, onSelect, showSubItems, onToggleSubItems }) => (
  <View style={styles.menuItemContainer}>
    <TouchableOpacity onPress={() => onToggleSubItems(item.id)} style={styles.menuItem}>
      <Text style={styles.menuText}>{item.label}</Text>
    </TouchableOpacity>
    {showSubItems && item.subItems && (
      <View style={styles.subMenuContainer}>
        {item.subItems.map((subItem) => (
          <TouchableOpacity key={subItem.id} onPress={() => onSelect(subItem)} style={styles.subMenuItem}>
            <Text style={styles.subMenuText}>{subItem.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    )}
  </View>
);

const MenuComponent = ({ items, onSelect }) => {
  const [visibleSubItemId, setVisibleSubItemId] = useState(null);

  const handleToggleSubItems = (itemId) => {
    setVisibleSubItemId(visibleSubItemId === itemId ? null : itemId);
  };

  return (
    <View style={styles.menuContainer}>
      {items.map((item) => (
        <MenuItem
          key={item.id}
          item={item}
          onSelect={onSelect}
          showSubItems={visibleSubItemId === item.id}
          onToggleSubItems={handleToggleSubItems}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  menuContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#eee',
    paddingVertical: 10,
    zIndex: 2, // Ensure menu is above other content
  },
  menuItemContainer: {
    alignItems: 'center',
    zIndex: 2, // Ensure menu items are above other content
  },
  menuItem: {
    padding: 10,
  },
  menuText: {
    fontSize: 16,
  },
  subMenuContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    backgroundColor: '#f9f9f9',
    padding: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    zIndex: 3, // Ensure submenus are above the menu and other content
  },
  subMenuItem: {
    paddingVertical: 5,
  },
  subMenuText: {
    fontSize: 14,
  },
});
export default MenuComponent;
