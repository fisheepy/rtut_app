import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const MenuItem = ({ item, onSelect, onToggleSubItems, visibleItemIds }) => {
  const isVisible = visibleItemIds.has(item.id);
  const toggleVisibility = () => onToggleSubItems(item.id);

  return (
    <View style={styles.menuItemContainer}>
      {item.subItems && item.subItems.length > 0 ? (
        <TouchableOpacity onPress={toggleVisibility} style={styles.menuItem}>
          <Text style={styles.menuText}>{item.label}</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity onPress={() => onSelect(item)} style={styles.menuItem}>
          <Text style={styles.menuText}>{item.label}</Text>
        </TouchableOpacity>
      )}
      {isVisible && item.subItems && (
        <View style={styles.subMenuContainer}>
          {item.subItems.map((subItem) => (
            <MenuItem
              key={subItem.id}
              item={subItem}
              onSelect={onSelect}
              onToggleSubItems={onToggleSubItems}
              visibleItemIds={visibleItemIds}
            />
          ))}
        </View>
      )}
    </View>
  );
};

const MenuComponent = ({ items, onSelect }) => {
  const [visibleItemIds, setVisibleItemIds] = useState(new Set());

  const handleToggleSubItems = (itemId) => {
    setVisibleItemIds(prevVisibleItemIds => {
      const newVisibleItemIds = new Set(prevVisibleItemIds);
      if (newVisibleItemIds.has(itemId)) {
        newVisibleItemIds.delete(itemId);
      } else {
        newVisibleItemIds.add(itemId);
      }
      return newVisibleItemIds;
    });
  };

  return (
    <View style={styles.menuContainer}>
      {items.map((item) => (
        <MenuItem
          key={item.id}
          item={item}
          onSelect={onSelect}
          onToggleSubItems={handleToggleSubItems}
          visibleItemIds={visibleItemIds}
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
    position: 'relative', // Allows the submenu to take up space and push content below
    marginTop: 5, // Provides a small gap between the parent item and the submenu for visual separation
    paddingLeft: 20, // Indents submenu items for hierarchy
    backgroundColor: '#f9f9f9',
    padding: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    zIndex: 3,
  },
  subMenuItem: {
    paddingVertical: 5,
  },
  subMenuText: {
    fontSize: 14,
  },
});
export default MenuComponent;
