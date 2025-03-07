const Role = require("../model/role.model");

const createRole = async (req, res) => {
    try {
      const { name } = req.body;
  
      const existingRole = await Role.findOne({ name });
      if (existingRole) return res.status(400).json({ message: "Role already exists" });
  
      const newRole = new Role({ name });
      await newRole.save();
  
      return res.status(201).json({ message: "Role created successfully", role: newRole });
    } catch (error) {
      return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
  };

  const getRoles = async (req, res) => {
    try {
        const roles = await Role.find();
       return res.status(200).json(roles);
    } catch (error) {
        return res.status(500).json({ message: "Error fetching roles", error });
    }
};

// Get role by ID
const getRoleById = async (req, res) => {
    try {
        const role = await Role.findById(req.params.id);
        if (!role) return res.status(404).json({ message: "Role not found" });
        return res.status(200).json(role);
    } catch (error) {
        return res.status(500).json({ message: "Error fetching role", error });
    }
};

// Update role
const updateRole = async (req, res) => {
    try {
        const updatedRole = await Role.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedRole) return res.status(404).json({ message: "Role not found" });
        return res.status(200).json({ message: "Role updated successfully", updatedRole });
    } catch (error) {
        return res.status(500).json({ message: "Error updating role", error });
    }
};

// Delete role
const deleteRole = async (req, res) => {
    try {
        const deletedRole = await Role.findByIdAndDelete(req.params.id);
        if (!deletedRole) return res.status(404).json({ message: "Role not found" });
        return res.status(200).json({ message: "Role deleted successfully" });
    } catch (error) {
        return res.status(500).json({ message: "Error deleting role", error });
    }
};

module.exports = {createRole, getRoles, getRoleById, updateRole, deleteRole };

