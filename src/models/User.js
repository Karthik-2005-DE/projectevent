import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
{
  name:{
    type:String,
    required:true
  },
  email:{
    type:String,
    required:true,
    unique:true
  },
  phonenumber:{
    type:Number,
    required:true
  },
  password:{
    type:String,
    required:true
  },
  role:{
    type:String,
    enum:["user","admin"],
    default:"user"
  },
  isDeleted:{
    type:Boolean,
    default:false
  }
},
{timestamps:true}
);

export default mongoose.model("User",userSchema);